/**
 * 7 天任务定义（PRD §5.1 + §18.3 文案库）
 * P1 用静态数据；P4 阶段如果要做 A/B 文案则改成 server-driven。
 */

import type { TaskDef } from '@/types';

export const TASKS: TaskDef[] = [
  {
    id: 'day1_safe_place',
    day: 1,
    kind: 'describe',
    theme: '搬家日',
    title: '你最常呆的地方',
    description: '说说你和它最常呆的地方是什么样子？',
  },
  {
    id: 'day2_family',
    day: 2,
    kind: 'describe',
    theme: '这是我们家',
    title: '介绍一个家里人',
    description: '告诉它你的一个家里人——是谁，是什么样的人。',
    inputPlaceholder: '比如：这是我妈妈，她最爱做饺子。',
    charLimit: 200,
  },
  {
    id: 'day3_place',
    day: 3,
    kind: 'describe',
    theme: '我们去过的地方',
    title: '去过的地方',
    description: '说说一个你去过的地方，那里发生了什么？',
    inputPlaceholder: '在那里发生了什么？',
    charLimit: 200,
  },
  {
    id: 'day4_what_i_like',
    day: 4,
    kind: 'text',
    theme: '我喜欢的事',
    title: '我喜欢的事',
    description: '写一段话告诉它吧。多写点也没关系。',
    inputPlaceholder: '我最喜欢的是……',
    charLimit: 300,
  },
  {
    id: 'day5_questions',
    day: 5,
    kind: 'choice',
    theme: '它问你的问题',
    title: '它问你的问题',
    description: '它想看看自己理解得对不对。',
  },
  {
    id: 'day6_review',
    day: 6,
    kind: 'memory_review',
    theme: '整理与补充',
    title: '打开它的脑袋',
    description: '它最近一直在整理记忆。进去看看吧——它有些事情拿不准，有些事情可能记错了。',
  },
  {
    id: 'day7_worldview',
    day: 7,
    kind: 'memory_review',
    theme: '它眼中的世界',
    title: '它眼中的世界',
    description: '它住满 7 天了，想给你看看它眼中的世界。',
  },
];

export function getTaskByDay(day: number): TaskDef | undefined {
  return TASKS.find((t) => t.day === day);
}
