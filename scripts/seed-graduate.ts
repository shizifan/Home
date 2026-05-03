/**
 * 种子脚本：让一只伙伴自动跑完 7 天 + 触发 Day7 worldview 生成。
 *
 * 用法（推荐 mock 模式，几秒搞定）：
 *   1) 终端 A:  TEST_LLM_MODE=mock npm run dev
 *   2) 终端 B:  npx tsx scripts/seed-graduate.ts
 *
 * 选项：
 *   --preset=xiaoqinglong   伙伴 preset_id（默认 xiaoqinglong）
 *   --name=小青龙           自定义名字（默认 ''）
 *   --no-reset              不清空旧数据
 *   --base-url=...          dev server 地址（默认 http://localhost:3000）
 *
 * 真实 LLM 模式：去掉 TEST_LLM_MODE=mock 即可，但要 5–10 倍时长 + 花钱。
 */

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (a.startsWith('--')) {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [[k, v]];
    }
    return [];
  }),
);

const BASE = (args['base-url'] ?? 'http://localhost:3001').replace(/\/$/, '');
const PRESET = args['preset'] ?? 'xiaoqinglong';
const NAME = args['name'] ?? '';
const RESET = args['no-reset'] !== 'true';

type Json = Record<string, unknown>;

async function call(
  method: 'GET' | 'POST',
  path: string,
  body?: Json,
): Promise<Json> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${JSON.stringify(json)}`,
    );
  }
  return json;
}

function step(msg: string) {
  console.log(`  • ${msg}`);
}

async function probeServer() {
  try {
    const r = await fetch(BASE + '/api/companion/state');
    if (r.status >= 500) throw new Error(`server returned ${r.status}`);
  } catch (e) {
    console.error(`✗ 无法连到 ${BASE}（${(e as Error).message}）`);
    console.error('  请先在另一个终端跑：TEST_LLM_MODE=mock npm run dev');
    process.exit(1);
  }
}

async function completeDescribeDay(companionId: string, taskId: string, day: number) {
  const text = SAMPLE_DESCRIPTIONS[day - 1];
  step(`Day ${day} describe: submit "${text.slice(0, 24)}…"`);
  const sub = (await call('POST', '/api/describe/submit', {
    companion_id: companionId,
    task_id: taskId,
    description_text: text,
    input_method: 'text',
  })) as { card_id: string; image_source?: string };
  step(`  → card_id=${sub.card_id} image_source=${sub.image_source ?? '?'}`);
  await call('POST', '/api/describe/confirm', { card_id: sub.card_id });
  step('  → confirmed');
}

async function completeTextDay(companionId: string, taskId: string, day: number) {
  const text = SAMPLE_DESCRIPTIONS[day - 1];
  step(`Day ${day} text: submit "${text.slice(0, 24)}…"`);
  await call('POST', '/api/text/submit', {
    companion_id: companionId,
    task_id: taskId,
    user_text: text,
  });
}

async function completeChoiceDay(companionId: string, taskId: string) {
  step(`Day 5 choice: GET questions`);
  const q = (await call(
    'GET',
    `/api/task/day5-questions?companion_id=${companionId}`,
  )) as { questions?: { question?: string }[] };
  const recap =
    q.questions?.map((qq, i) => `Q${i + 1}: ${qq.question ?? ''}`).join(' / ') ?? '';
  const answer = (recap ? `${recap}\n\n` : '') + SAMPLE_DESCRIPTIONS[4];
  step(`  → submit ${q.questions?.length ?? 0} 道答案`);
  await call('POST', '/api/text/submit', {
    companion_id: companionId,
    task_id: taskId,
    user_text: answer,
  });
}

async function completeMemoryReviewDay(
  companionId: string,
  taskId: string,
  day: number,
) {
  step(`Day ${day} memory_review: 用 skip 标记完成（dev 简化）`);
  await call('POST', '/api/task/skip', {
    companion_id: companionId,
    task_id: taskId,
  });
}

const TASKS = [
  { day: 1, id: 'day1_safe_place', kind: 'describe' },
  { day: 2, id: 'day2_family', kind: 'describe' },
  { day: 3, id: 'day3_place', kind: 'describe' },
  { day: 4, id: 'day4_what_i_like', kind: 'text' },
  { day: 5, id: 'day5_questions', kind: 'choice' },
  { day: 6, id: 'day6_review', kind: 'memory_review' },
  { day: 7, id: 'day7_worldview', kind: 'memory_review' },
] as const;

const SAMPLE_DESCRIPTIONS = [
  // Day 1 — 最常呆的地方：自己卧室角落 + 一个具体小道具
  '我房间的窗台那里。我经常趴在那儿看下面的人。窗台上有我从海边捡的两个大贝壳，还有一只我小时候的兔子玩偶，耳朵都被我揉得软软的了。',

  // Day 2 — 家里人：选爷爷，给一个具体场景而不是泛泛介绍
  '我想介绍我爷爷。他个子不高，头发都白了，但他每天早上都要去公园打太极。他不爱说话，但他会偷偷给我留他买的桃酥，藏在他抽屉的铁盒里。',

  // Day 3 — 去过的地方：一个小学秋游回忆，有冲突有细节
  '上次秋游我们去了一个茶园。山上特别冷，风把我的帽子吹跑了，是我同桌帮我捡回来的。后来我们一起在山顶吃面包，能看到远处的水库，水是绿色的，特别像电视里的样子。',

  // Day 4 — 喜欢的事：稍微长一点，有展开
  '我最喜欢的事是周末下午一个人在家，开着空调，躺在沙发上看漫画。最近在追《名侦探柯南》，已经看到 80 多本了。妈妈不让我一直看，但我会偷偷把漫画夹在课本里看，她每次都被我骗到哈哈。',

  // Day 5 — 答题文本（脚本会把题目串进来再 + 这段做答案语气）
  '嗯——第 1 题我觉得是对的，第 2 题不太对，那个是我表姐，不是我姐姐。',

  '', // Day 6 memory_review，skip 标记完成
  '', // Day 7 memory_review，skip 标记完成
];

async function main() {
  console.log(`=== seed-graduate (preset=${PRESET}, base=${BASE}) ===`);
  await probeServer();

  if (RESET) {
    step('reset (清空旧伙伴 + uploads)');
    await call('POST', '/api/dev/reset');
  }

  step(`create companion (preset=${PRESET}${NAME ? `, name=${NAME}` : ''})`);
  const created = (await call('POST', '/api/companion/create', {
    preset_id: PRESET,
    custom_name: NAME,
  })) as { companion: { id: string; current_day: number } };
  const cid = created.companion.id;
  console.log(`  → companion_id=${cid}\n`);

  for (let i = 0; i < 6; i++) {
    const t = TASKS[i];
    console.log(`— Day ${t.day} (${t.kind}) —`);
    if (t.kind === 'describe') await completeDescribeDay(cid, t.id, t.day);
    else if (t.kind === 'text') await completeTextDay(cid, t.id, t.day);
    else if (t.kind === 'choice') await completeChoiceDay(cid, t.id);
    else if (t.kind === 'memory_review')
      await completeMemoryReviewDay(cid, t.id, t.day);

    step(`advance → Day ${t.day + 1}`);
    const adv = (await call('POST', '/api/companion/advance')) as {
      new_day: number;
    };
    if (adv.new_day !== t.day + 1) {
      throw new Error(`advance 异常：期望 Day ${t.day + 1}，得到 ${adv.new_day}`);
    }
    console.log('');
  }

  console.log(`— Day 7 (memory_review) —`);
  await completeMemoryReviewDay(cid, TASKS[6].id, 7);
  step('POST /api/day7/generate');
  const gen = (await call('POST', '/api/day7/generate', {
    companion_id: cid,
  })) as { worldview?: Json; from_cache?: boolean };
  if (!gen.worldview) {
    console.warn('  ⚠ worldview 为空，检查日志');
  } else {
    step(`  → from_cache=${gen.from_cache} keys=${Object.keys(gen.worldview).join(',')}`);
  }

  console.log('\n✓ 完成');
  console.log(`  companion_id: ${cid}`);
  console.log(`  访问主页:     ${BASE}/home`);
  console.log(`  毕业卡:       ${BASE}/day7/graduation`);
  console.log(`  世界观档案:   ${BASE}/day7/worldview`);
  console.log('');
  console.log('注：companions.graduated_at 字段当前没有任何代码会写入；');
  console.log('    如果伙伴驿站功能需要它，要么在驿站功能里补写入，要么手动 SQL update。');
}

main().catch((e) => {
  console.error('\n✗ 出错:', e.message);
  process.exit(1);
});
