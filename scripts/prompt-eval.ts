/**
 * Prompt 调优评估（PRD §23.16）
 *
 * 用法：
 *   npm run prompt:eval                 # 跑所有评估集
 *   npm run prompt:eval -- --only=pass1 # 只跑 pass1
 *
 * 行为：
 *   1. 加载 scripts/eval-data/pass1.json（金标准样本集）
 *   2. 对每条样本调 runPass1，比对 action + concept_name 关键词
 *   3. 按 action 分桶报告准确率；列出失败样本
 *   4. 通过线（PRD §23.16）：
 *      - action 准确率 ≥ 85%
 *      - concept_name 同义合并准确率 ≥ 90%
 *      - 误把真实输入归到 set_aside 比例 < 5%
 *
 * 注：评估直接命中真实 LLM 端点（DeepSeek 等），按 ~$0.005/样本估，15 条 ~$0.08。
 */

import path from 'node:path';
import { readFileSync } from 'node:fs';

// 注：环境变量由 npm script 内的 `tsx --env-file=.env.local` 加载，无需 dotenv 依赖。
// 如果直接 `tsx scripts/prompt-eval.ts` 跑，请先 `set -a; source .env.local; set +a;`

import { runPass1 } from '../src/lib/llm/pass1';
import { getCompanionPreset } from '../src/lib/companionPresets';
import type {
  ConceptCategory,
  MemoryBankEntry,
  MemoryInputType,
} from '../src/types';

interface ExpectedRow {
  action: 'create_new' | 'append_to_existing' | 'mark_uncertain' | 'set_aside';
  concept_name_keywords: string[];
  concept_category?: ConceptCategory;
  target_concept_id?: string;
}

interface SampleRow {
  id: string;
  input_type: MemoryInputType;
  input_content: string;
  memory_bank: Partial<MemoryBankEntry>[];
  expected: ExpectedRow;
}

interface DataFile {
  version: string;
  samples: SampleRow[];
}

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (a.startsWith('--')) {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [[k, v]];
    }
    return [];
  }),
);

const ONLY = (args['only'] as string | undefined) ?? null;

interface EvalResult {
  id: string;
  expectedAction: ExpectedRow['action'];
  actualAction: string | null;
  actionMatch: boolean;
  conceptNameMatch: boolean;
  conceptCategoryMatch: boolean;
  notes: string;
}

function fakeMemoryBank(rows: Partial<MemoryBankEntry>[]): MemoryBankEntry[] {
  // pass1 的 prompt 拼接只读 id/type/concept_name/concept_category/ai_summary，其它字段填默认值不影响
  return rows.map((r) => ({
    id: r.id ?? 'unknown',
    companion_id: 'eval',
    type: (r.type ?? 'remembered') as MemoryBankEntry['type'],
    concept_name: r.concept_name ?? '',
    concept_category: r.concept_category as ConceptCategory | undefined,
    ai_summary: r.ai_summary,
    ai_reasoning: r.ai_reasoning,
    evidence: r.evidence ?? [],
    confidence: r.confidence ?? 0.5,
    user_corrected: false,
    user_correction_history: [],
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }));
}

function partialMatch(actual: string, keywords: string[]): boolean {
  if (!actual) return false;
  const lower = actual.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

async function evalPass1(): Promise<void> {
  const file: DataFile = JSON.parse(
    readFileSync(path.join(process.cwd(), 'scripts/eval-data/pass1.json'), 'utf8'),
  );

  console.log(`\n=== Pass 1 评估 (n=${file.samples.length}) ===\n`);

  // 用一只通用伙伴跑（小青龙）— Pass1 的 prompt 不依赖具体伙伴选择
  const preset = getCompanionPreset('xiaoqinglong');
  if (!preset) {
    console.error('找不到 xiaoqinglong preset，eval 终止');
    process.exit(1);
  }

  const results: EvalResult[] = [];
  for (const sample of file.samples) {
    process.stdout.write(`  [${sample.id}] `);
    const memoryBank = fakeMemoryBank(sample.memory_bank);
    const t0 = Date.now();
    let actualAction: string | null = null;
    let actualConceptName = '';
    let actualConceptCategory = '';
    try {
      const result = await runPass1({
        companion: preset,
        day: 1,
        inputType: sample.input_type,
        inputContent: sample.input_content,
        memoryBank,
      });
      if (result.success) {
        actualAction = result.data.action;
        actualConceptName = result.data.concept_name ?? '';
        actualConceptCategory = result.data.concept_category ?? '';
      } else {
        actualAction = '(failed:' + result.reason + ')';
      }
    } catch (e) {
      actualAction = '(error:' + ((e as Error).message ?? 'unknown') + ')';
    }
    const ms = Date.now() - t0;

    const actionMatch = actualAction === sample.expected.action;
    const conceptNameMatch = partialMatch(
      actualConceptName,
      sample.expected.concept_name_keywords,
    );
    const conceptCategoryMatch =
      !sample.expected.concept_category ||
      actualConceptCategory === sample.expected.concept_category;

    process.stdout.write(
      `${actionMatch ? '✓' : '✗'} action=${actualAction} ` +
        `concept="${actualConceptName.slice(0, 16)}" (${ms}ms)\n`,
    );

    results.push({
      id: sample.id,
      expectedAction: sample.expected.action,
      actualAction,
      actionMatch,
      conceptNameMatch,
      conceptCategoryMatch,
      notes: actionMatch
        ? ''
        : `expected=${sample.expected.action}, got=${actualAction}; concept_keywords=${sample.expected.concept_name_keywords.join('|')}, got="${actualConceptName}"`,
    });
  }

  // ─── 报告 ───
  const total = results.length;
  const actionPass = results.filter((r) => r.actionMatch).length;
  const conceptPass = results.filter((r) => r.conceptNameMatch).length;
  const categoryPass = results.filter((r) => r.conceptCategoryMatch).length;

  const actionRate = (actionPass / total) * 100;
  const conceptRate = (conceptPass / total) * 100;
  const categoryRate = (categoryPass / total) * 100;

  // 按 action 分桶
  const buckets: Record<string, { total: number; pass: number }> = {};
  for (const r of results) {
    const k = r.expectedAction;
    if (!buckets[k]) buckets[k] = { total: 0, pass: 0 };
    buckets[k].total += 1;
    if (r.actionMatch) buckets[k].pass += 1;
  }

  // false-positive set_aside（应该是其他动作但被分到 set_aside）
  const fpSetAside = results.filter(
    (r) => r.expectedAction !== 'set_aside' && r.actualAction === 'set_aside',
  ).length;
  const fpSetAsideRate =
    (fpSetAside /
      results.filter((r) => r.expectedAction !== 'set_aside').length) *
    100;

  console.log(`\n──────────────────`);
  console.log(`总样本：${total}`);
  console.log(`action 准确率：${actionPass}/${total} (${actionRate.toFixed(1)}%) — PRD §23.16 通过线 ≥ 85%${actionRate >= 85 ? ' ✓' : ' ✗'}`);
  console.log(`concept_name 部分匹配：${conceptPass}/${total} (${conceptRate.toFixed(1)}%) — 通过线 ≥ 90%${conceptRate >= 90 ? ' ✓' : ' ✗'}`);
  console.log(`concept_category 准确率：${categoryPass}/${total} (${categoryRate.toFixed(1)}%)`);
  console.log(
    `误把真实输入归到 set_aside：${fpSetAside}/${total - (buckets['set_aside']?.total ?? 0)} (${fpSetAsideRate.toFixed(1)}%) — 通过线 < 5%${fpSetAsideRate < 5 ? ' ✓' : ' ✗'}`,
  );
  console.log(`\n按 action 分桶：`);
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`  ${k.padEnd(20)} : ${v.pass}/${v.total} (${((v.pass / v.total) * 100).toFixed(0)}%)`);
  }

  const failures = results.filter((r) => !r.actionMatch || !r.conceptNameMatch);
  if (failures.length > 0) {
    console.log(`\n失败样本（${failures.length}）：`);
    for (const f of failures) {
      console.log(`  • ${f.id}: ${f.notes}`);
    }
  }
  console.log('');
}

async function main() {
  if (!ONLY || ONLY === 'pass1') {
    await evalPass1();
  }
  // future: pass2 / day7 evals
}

main().catch((e) => {
  console.error('\n✗ eval 出错:', e);
  process.exit(1);
});
