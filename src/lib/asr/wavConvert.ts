'use client';

/**
 * 浏览器端音频格式转换：任意录音 Blob → 16kHz mono 16-bit PCM WAV
 *
 * 为什么需要：DashScope Paraformer 流式 ASR 要求 16k mono PCM。
 * MediaRecorder 录到的是 webm/opus（或 iOS Safari 的 mp4/aac），
 * 直接传过去后端无法识别。
 *
 * 实现：AudioContext.decodeAudioData → OfflineAudioContext 重采样到 16k mono
 *      → encodeWav 写入 RIFF/WAVE 头。
 *
 * 失败模式：
 *   - decodeAudioData 抛错（损坏数据 / 格式不支持）→ 透传
 *   - 重采样后峰值过低（<0.005）→ throw 'silent_input'，调用方走「没听清」提示
 */

const TARGET_SAMPLE_RATE = 16_000;
const SILENT_PEAK_THRESHOLD = 0.005;

export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  const NativeCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeCtx = new NativeCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close().catch(() => {});
  }

  const targetLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const src = offlineCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offlineCtx.destination);
  src.start(0);
  const resampled = await offlineCtx.startRendering();
  const pcm = resampled.getChannelData(0);

  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  if (peak < SILENT_PEAK_THRESHOLD) {
    throw new Error('silent_input');
  }

  const buf = encodeWav(pcm, resampled.sampleRate);
  return new Blob([buf], { type: 'audio/wav' });
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buffer);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
