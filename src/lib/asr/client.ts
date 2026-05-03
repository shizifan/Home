/**
 * ASR Client — 阿里 DashScope Paraformer-realtime（WebSocket 流式）
 *
 * 协议：wss://dashscope.aliyuncs.com/api-ws/v1/inference/
 *   1. 连接（Authorization: bearer <key>）
 *   2. 发 run-task JSON（model / format / sample_rate）
 *   3. 收 task-started → 二进制分帧发 PCM（每 3200B ≈ 200ms @16k 16bit mono）
 *   4. 全发完 → 发 finish-task JSON
 *   5. 期间收 result-generated（含 sentence.text + sentence_end 标志）
 *   6. 收 task-finished → 拼好 transcription 返回
 *
 * 失败：返回 ASRFailure，调用方走切换文字输入提示。
 */

import 'server-only';

import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import WebSocket from 'ws';

import { logLLMCall } from '@/lib/db/repos';

export interface ASRResult {
  transcription: string;
  confidence: number;
  duration_seconds: number;
}

export type ASRFailReason = 'empty' | 'safety' | 'timeout' | 'http' | 'unsupported';

export interface ASRFailure {
  reason: ASRFailReason;
  message?: string;
}

const DASHSCOPE_WS_URL =
  process.env.DASHSCOPE_ASR_BASE_URL ??
  'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
const DEFAULT_MODEL = process.env.DASHSCOPE_ASR_MODEL ?? 'paraformer-realtime-v2';
const TIMEOUT_MS = 15_000;
const FRAME_BYTES = 3200; // ~200ms @ 16kHz mono 16bit
const FRAME_INTERVAL_MS = 50;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

const MOCK_RESULT: ASRResult = {
  transcription: '我的卧室，有一张蓝色的床，窗外能看到大树。',
  confidence: 0.95,
  duration_seconds: 8.3,
};

export async function recognizeAudioFile(
  filePath: string,
  companionId?: string,
): Promise<ASRResult | ASRFailure> {
  if (process.env.TEST_LLM_MODE === 'mock') {
    return MOCK_RESULT;
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('[asr] DASHSCOPE_API_KEY not set');
    return { reason: 'http', message: 'asr not configured' };
  }

  try {
    const stats = await stat(filePath);
    if (stats.size > MAX_AUDIO_BYTES) {
      return { reason: 'unsupported', message: 'audio too large (>2MB)' };
    }

    const buf = await readFile(filePath);
    const wav = parseWavHeader(buf);

    let pcm: Buffer;
    let sampleRate: number;
    let format: 'pcm' | 'wav';
    if (wav && wav.bitsPerSample === 16 && wav.channels === 1) {
      pcm = buf.subarray(wav.dataOffset, wav.dataOffset + wav.dataSize);
      sampleRate = wav.sampleRate;
      format = 'pcm';
    } else {
      // 非标准 WAV，整段交给 DashScope（format=wav 让其自行解码）
      console.warn('[asr] non-standard wav, sending raw', {
        valid: !!wav,
        channels: wav?.channels,
        sampleRate: wav?.sampleRate,
        bps: wav?.bitsPerSample,
      });
      pcm = buf;
      sampleRate = wav?.sampleRate ?? 16_000;
      format = 'wav';
    }

    return await streamRecognize({ pcm, sampleRate, format, apiKey, companionId });
  } catch (err) {
    console.error('[asr] read failed:', (err as Error)?.message ?? err);
    return { reason: 'http', message: (err as Error)?.message };
  }
}

interface StreamArgs {
  pcm: Buffer;
  sampleRate: number;
  format: 'pcm' | 'wav';
  apiKey: string;
  companionId?: string;
}

function streamRecognize(args: StreamArgs): Promise<ASRResult | ASRFailure> {
  const { pcm, sampleRate, format, apiKey, companionId } = args;
  const taskId = randomUUID().replace(/-/g, '');
  const start = Date.now();

  return new Promise((resolve) => {
    const ws = new WebSocket(DASHSCOPE_WS_URL, {
      headers: {
        Authorization: `bearer ${apiKey}`,
        'X-DashScope-DataInspection': 'enable',
      },
    });

    const sentences: string[] = [];
    let started = false;
    let settled = false;

    const finish = async (r: ASRResult | ASRFailure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      const isOk = 'transcription' in r;
      try {
        await logLLMCall({
          companionId,
          callType: 'asr',
          model: DEFAULT_MODEL,
          latencyMs: Date.now() - start,
          success: isOk,
          failReason: isOk ? undefined : r.reason,
        });
      } catch {
        /* logLLMCall 失败不影响主流程 */
      }
      resolve(r);
    };

    const timeoutTimer = setTimeout(
      () => finish({ reason: 'timeout', message: `asr timeout after ${TIMEOUT_MS}ms` }),
      TIMEOUT_MS,
    );

    ws.on('open', () => {
      const runTask = {
        header: {
          action: 'run-task',
          task_id: taskId,
          streaming: 'duplex',
        },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: DEFAULT_MODEL,
          parameters: {
            format,
            sample_rate: sampleRate,
          },
          input: {},
        },
      };
      ws.send(JSON.stringify(runTask));
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg: WSMessage;
      try {
        msg = JSON.parse(data.toString()) as WSMessage;
      } catch {
        return;
      }
      const event = msg?.header?.event;

      if (event === 'task-started') {
        started = true;
        void sendFrames(ws, pcm, taskId, () => settled);
      } else if (event === 'result-generated') {
        const sentence = msg.payload?.output?.sentence;
        if (sentence?.text) {
          const isEnd =
            sentence.sentence_end === true ||
            (sentence.end_time !== undefined && sentence.end_time !== null);
          if (isEnd) {
            sentences.push(sentence.text);
          }
        }
      } else if (event === 'task-finished') {
        const text = sentences.join('').trim();
        if (!text) {
          finish({ reason: 'empty' });
        } else {
          finish({
            transcription: text,
            confidence: 0.9,
            duration_seconds: pcm.length / (sampleRate * 2),
          });
        }
      } else if (event === 'task-failed') {
        const code = msg.header?.error_code;
        const errMsg = msg.header?.error_message;
        finish({ reason: 'http', message: `${code ?? 'task-failed'}: ${errMsg ?? ''}` });
      }
    });

    ws.on('error', (e) => {
      finish({ reason: 'http', message: e.message });
    });

    ws.on('close', () => {
      if (!settled) {
        finish({
          reason: started ? 'http' : 'timeout',
          message: 'ws closed before task-finished',
        });
      }
    });
  });
}

async function sendFrames(
  ws: WebSocket,
  pcm: Buffer,
  taskId: string,
  isSettled: () => boolean,
) {
  for (let off = 0; off < pcm.length; off += FRAME_BYTES) {
    if (isSettled() || ws.readyState !== WebSocket.OPEN) return;
    const frame = pcm.subarray(off, Math.min(off + FRAME_BYTES, pcm.length));
    ws.send(frame);
    await sleep(FRAME_INTERVAL_MS);
  }
  if (isSettled() || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
      payload: { input: {} },
    }),
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

/**
 * 解析 RIFF/WAVE 头，定位到 data chunk（fmt chunk 不一定固定 16 字节）。
 * 失败返回 null。
 */
function parseWavHeader(buf: Buffer): WavInfo | null {
  if (buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(payloadStart + 2);
      sampleRate = buf.readUInt32LE(payloadStart + 4);
      bitsPerSample = buf.readUInt16LE(payloadStart + 14);
    } else if (chunkId === 'data') {
      dataOffset = payloadStart;
      dataSize = chunkSize;
      break;
    }
    offset = payloadStart + chunkSize + (chunkSize % 2); // chunks 字节对齐
  }

  if (dataOffset < 0 || sampleRate === 0) return null;
  return { sampleRate, channels, bitsPerSample, dataOffset, dataSize };
}

interface WSMessage {
  header?: {
    event?: string;
    task_id?: string;
    error_code?: string;
    error_message?: string;
  };
  payload?: {
    output?: {
      sentence?: {
        text?: string;
        sentence_end?: boolean;
        end_time?: number | null;
      };
    };
  };
}

export function isASRResult(r: ASRResult | ASRFailure): r is ASRResult {
  return 'transcription' in r;
}
