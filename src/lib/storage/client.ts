/**
 * 对象存储客户端 — 阿里云 OSS
 *
 * V1.0 新增：替代 V0.6.1 的本地 public/uploads/ 存储。
 * 用于图片（cards、graduation）和语音（uploads_voice）的持久化存储。
 *
 * TEST_LLM_MODE=mock 时返回本地路径，不需要真实 OSS。
 */

import 'server-only';

let _ossClient: OSSClient | null = null;

interface OSSClient {
  put(key: string, filePath: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

export interface UploadResult {
  url: string;
  key: string;
}

/** 上传文件到 OSS，返回公开访问 URL */
export async function uploadToOSS(
  localPath: string,
  remoteKey: string,
): Promise<UploadResult> {
  // Mock 模式：返回本地路径
  if (process.env.TEST_LLM_MODE === 'mock') {
    return {
      url: `/mock-images/${remoteKey}`,
      key: remoteKey,
    };
  }

  const client = getClient();
  const result = await client.put(remoteKey, localPath);
  return { url: result.url, key: remoteKey };
}

/** 从 OSS 删除文件 */
export async function deleteFromOSS(remoteKey: string): Promise<void> {
  if (process.env.TEST_LLM_MODE === 'mock') return;
  const client = getClient();
  await client.delete(remoteKey);
}

/** 生成语音/图片的 OSS key */
export function ossKey(
  dir: 'uploads_voice' | 'cards' | 'graduation',
  companionId: string,
  fileName: string,
): string {
  return `${dir}/${companionId}/${fileName}`;
}

function getClient(): OSSClient {
  if (_ossClient) return _ossClient;

  const OSS = require('ali-oss');
  const client = new OSS({
    region: process.env.OSS_REGION!,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: process.env.OSS_BUCKET!,
  });
  _ossClient = client;
  return client;
}
