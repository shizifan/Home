/**
 * 01_main_loop.spec 共用 helpers
 *
 * 仅服务于主干 happy-path（Day 1→7 + worldview）。
 * 节点完整性验证，不验视觉/文案质量。
 *
 * 设计原则：尽量走 UI；只有 Day 6 memory_review 走 API skip 兜底
 * （memory bank 是否真有 uncertain 条目取决于 LLM 在 Day 1-5 的提取结果，不稳定）。
 */

import type { APIRequestContext } from '@playwright/test';

/**
 * 复用自 scripts/seed-graduate.ts 的 SAMPLE_DESCRIPTIONS。
 * 只取 Day 1-4 这 4 段（Day 5 是 LLM 出题 + 选项，没有自由文本；
 * Day 6/7 用 API skip / 看页面，不需要文本）。
 */
export const SAMPLE_TEXTS = [
  // Day 1 — 最常呆的地方
  '我房间的窗台那里。我经常趴在那儿看下面的人。窗台上有我从海边捡的两个大贝壳，还有一只我小时候的兔子玩偶，耳朵都被我揉得软软的了。',
  // Day 2 — 家里人
  '我想介绍我爷爷。他个子不高，头发都白了，但他每天早上都要去公园打太极。他不爱说话，但他会偷偷给我留他买的桃酥，藏在他抽屉的铁盒里。',
  // Day 3 — 去过的地方
  '上次秋游我们去了一个茶园。山上特别冷，风把我的帽子吹跑了，是我同桌帮我捡回来的。后来我们一起在山顶吃面包，能看到远处的水库，水是绿色的，特别像电视里的样子。',
  // Day 4 — 喜欢的事
  '我最喜欢的事是周末下午一个人在家，开着空调，躺在沙发上看漫画。最近在追《名侦探柯南》，已经看到 80 多本了。妈妈不让我一直看，但我会偷偷把漫画夹在课本里看，她每次都被我骗到哈哈。',
];

interface CompanionState {
  companion?: {
    id: string;
    display_name: string;
    current_day: number;
    graduated: boolean;
  };
  today_task?: { id: string; kind: string } | null;
  today_done?: boolean;
  can_advance?: boolean;
  can_view_worldview?: boolean;
}

export async function resetDb(request: APIRequestContext): Promise<void> {
  const r = await request.post('/api/dev/reset');
  if (!r.ok()) {
    throw new Error(`reset failed: ${r.status()} ${await r.text()}`);
  }
}

export async function getState(request: APIRequestContext): Promise<CompanionState> {
  const r = await request.get('/api/companion/state');
  if (!r.ok()) throw new Error(`state failed: ${r.status()}`);
  return (await r.json()) as CompanionState;
}

/**
 * Day 6 memory_review 兜底：直接调 /api/task/skip 完成今天任务。
 * Happy-path 妥协：见 spec/E2E_Main_Loop_Plan_V0.1.md §3 / §6。
 */
export async function skipTodayTask(request: APIRequestContext): Promise<void> {
  const s = await getState(request);
  if (!s.companion?.id || !s.today_task?.id) {
    throw new Error(`no companion or today_task: ${JSON.stringify(s)}`);
  }
  const r = await request.post('/api/task/skip', {
    data: { companion_id: s.companion.id, task_id: s.today_task.id },
  });
  if (!r.ok()) {
    throw new Error(`skip failed: ${r.status()} ${await r.text()}`);
  }
}
