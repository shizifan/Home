/**
 * 同时调用 DashScope 和 MiniMax 图像生成，二者都跑完返回。
 *
 * 测试期：保留两份结果给前端横向对比。后续选定主力后改为 race。
 */

import 'server-only';

import {
  generateImageDashScope,
  type ImageGenInput,
  type ImageGenResult,
} from './client';
import { generateImageMiniMax } from './minimaxClient';

export interface ParallelImageGenResult {
  dashscope: ImageGenResult | null;
  minimax: ImageGenResult | null;
}

export async function generateImagesParallel(
  input: ImageGenInput,
  companionId?: string,
): Promise<ParallelImageGenResult> {
  const [dashscope, minimax] = await Promise.all([
    generateImageDashScope(input, companionId),
    generateImageMiniMax(input, companionId),
  ]);
  return { dashscope, minimax };
}
