/**
 * ASR 烟测脚本
 *
 * 用法：
 *   npx tsx --conditions=react-server scripts/asr-smoke.ts [audioPath]
 *
 *   注：必须加 --conditions=react-server，否则 client.ts 顶部的
 *   `import 'server-only'` 会抛错（server-only 包用 react-server
 *   条件 export 切换 server/client 入口）。
 *
 * 默认读 /Users/shizifan/Develop/Interview/test_tts_output.wav
 * （已知是 16kHz mono 16-bit PCM WAV）
 *
 * 跳过数据库（LLM_LOG_TO_DB=false），只验证 DashScope 协议是否对得上。
 */

import { existsSync, readFileSync } from 'node:fs';

// 手动读 .env.local，避免新增 dotenv 依赖
function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k]) continue;
    process.env[k] = raw.replace(/^['"]|['"]$/g, '');
  }
}
loadDotenv('.env.local');
process.env.LLM_LOG_TO_DB = 'false';

const audioPath =
  process.argv[2] ?? '/Users/shizifan/Develop/Interview/test_tts_output.wav';

if (!existsSync(audioPath)) {
  console.error(`audio file not found: ${audioPath}`);
  process.exit(1);
}

if (!process.env.DASHSCOPE_API_KEY) {
  console.error('DASHSCOPE_API_KEY not set in .env.local');
  process.exit(1);
}

async function main() {
  const { recognizeAudioFile } = await import('../src/lib/asr/client');
  console.log('=== asr-smoke ===');
  console.log('audio:', audioPath);
  console.log('model:', process.env.DASHSCOPE_ASR_MODEL ?? 'paraformer-realtime-v2');
  console.log('url:  ', process.env.DASHSCOPE_ASR_BASE_URL ?? '(default wss)');
  console.log('---');
  const t0 = Date.now();
  const r = await recognizeAudioFile(audioPath);
  console.log(`elapsed: ${Date.now() - t0}ms`);
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error('smoke failed:', e);
  process.exit(2);
});
