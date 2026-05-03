/**
 * 端到端编排：纠正记忆面板 → 写库 + 调 LLM 反馈 + 更新概念。
 * 5 种动作（PRD §5.8 + §15.5）：
 *   - restore：把 set_aside / uncertain 的概念移到 remembered
 *   - dismiss：把 remembered 的概念移到 set_aside
 *   - clarify：在 uncertain 上加一段澄清，移到 remembered
 *   - rename：改 concept_name
 *   - merge：把两个概念合到一起（保留目标，源的 evidence 转移过来）
 */

import 'server-only';

import {
  appendCorrectionHistory,
  appendEvidenceToMemoryBank,
  upsertMemoryBankEntry,
  deleteMemoryBankEntry,
  findMemoryBankById,
  getCompanionById,
  insertCompanionLine,
  insertMemory,
  setMemoryBankType,
} from '@/lib/db/repos';
import { execute } from '@/lib/db/client';
import { getCompanionPreset } from '@/lib/companionPresets';
import { runCorrection } from '@/lib/llm/correction';
import type { CorrectionAction, DayNumber, MemoryBankEntry } from '@/types';

export interface CorrectionRequest {
  memoryId: string;
  action: CorrectionAction;
  params?: {
    /** clarify 的孩子澄清文本 */
    clarification?: string;
    /** rename 的新名字 */
    newName?: string;
    /** merge 的目标 memory_bank id */
    targetMemoryId?: string;
  };
}

export interface CorrectionResult {
  feedback: string;
  newType?: MemoryBankEntry['type'];
  newConceptName?: string;
}

export async function correctMemory(req: CorrectionRequest): Promise<CorrectionResult> {
  const entry = await findMemoryBankById(req.memoryId);
  if (!entry) throw new Error('memory_bank entry not found');

  const companion = await getCompanionById(entry.companion_id);
  if (!companion) throw new Error('companion not found');
  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) throw new Error('preset not found');

  const oldUnderstanding = entry.ai_summary ?? entry.concept_name;
  let newUnderstanding = oldUnderstanding;
  let newType: MemoryBankEntry['type'] | undefined;
  let newConceptName: string | undefined;
  let correctionDetails = '';

  switch (req.action) {
    case 'restore':
      newType = 'remembered';
      newUnderstanding = `孩子说"${entry.concept_name}"是真的，要我记住。`;
      correctionDetails = `把"${entry.concept_name}"重新记起来`;
      await setMemoryBankType(req.memoryId, 'remembered');
      break;

    case 'dismiss':
      newType = 'set_aside';
      newUnderstanding = `孩子说"${entry.concept_name}"不重要，让我放下。`;
      correctionDetails = `让我把"${entry.concept_name}"放下`;
      await setMemoryBankType(req.memoryId, 'set_aside');
      break;

    case 'clarify': {
      const clar = (req.params?.clarification ?? '').toString().trim().slice(0, 300);
      newUnderstanding = clar
        ? `孩子澄清说："${clar}"`
        : `孩子给了一个澄清。`;
      correctionDetails = `孩子澄清了"${entry.concept_name}"：${clar}`;
      newType = 'remembered';
      // 把澄清写到 ai_summary 末尾
      await execute(
        `update memory_bank set ai_summary = concat(coalesce(ai_summary,''), '\n[澄清] ', :c), type = 'remembered', cache_dirty = true where id = :id`,
        { c: clar, id: req.memoryId },
      );
      break;
    }

    case 'rename': {
      const name = (req.params?.newName ?? '').toString().trim().slice(0, 60);
      if (!name) throw new Error('rename: empty new name');
      newConceptName = name;
      correctionDetails = `把"${entry.concept_name}"改名为"${name}"`;
      newUnderstanding = `孩子让我把它叫做"${name}"。`;
      await execute(
        `update memory_bank set concept_name = :n, cache_dirty = true where id = :id`,
        { n: name, id: req.memoryId },
      );
      break;
    }

    case 'merge': {
      const targetId = req.params?.targetMemoryId;
      if (!targetId || targetId === req.memoryId)
        throw new Error('merge: invalid target');
      const target = await findMemoryBankById(targetId);
      if (!target || target.companion_id !== entry.companion_id)
        throw new Error('merge: target not found or wrong companion');

      // 把当前 entry 的 evidence 全部追加到 target
      const evidences = Array.isArray(entry.evidence) ? entry.evidence : [];
      for (const ev of evidences) {
        await appendEvidenceToMemoryBank(targetId, ev);
      }
      // 删除当前 entry
      await execute(`delete from memory_bank where id = :id`, { id: req.memoryId });
      correctionDetails = `把"${entry.concept_name}"和"${target.concept_name}"合到一起`;
      newUnderstanding = `孩子说"${entry.concept_name}"和"${target.concept_name}"是一回事。`;
      // 在 target 上记录 correction history
      await appendCorrectionHistory(targetId, {
        action: 'merge',
        at: new Date().toISOString(),
        payload: { from: req.memoryId, fromName: entry.concept_name },
      });
      break;
    }

    case 'inform': {
      // 「我还不知道的事」上孩子选择"告诉它一个" → 在 unknown 上写孩子的输入 + 删 unknown 行 + 创建一条 remembered
      // params.clarification = 孩子的描述文本
      const childText = (req.params?.clarification ?? '').toString().trim().slice(0, 300);
      if (entry.type !== 'unknown') {
        throw new Error('inform only applies to unknown');
      }
      const conceptName = entry.concept_name;
      // 1. 写一条 memories（type=text）作为证据来源
      const memory = await insertMemory({
        companionId: entry.companion_id,
        day: companion.current_day as DayNumber,
        type: 'text',
        userText: childText || `（关于"${conceptName}"）`,
        taskId: 'memory_panel_inform',
        taskQuestion: `关于"${conceptName}"，孩子主动告诉伙伴的事。`,
      });
      // 2. 创建 remembered 概念
      const remembered = await upsertMemoryBankEntry({
        companionId: entry.companion_id,
        type: 'remembered',
        conceptName,
        conceptCategory: entry.concept_category,
        aiSummary: childText || `孩子告诉了我关于"${conceptName}"的事。`,
        aiReasoning: `孩子主动从我"还不知道的事"里挑了"${conceptName}"告诉我。`,
        evidence: [{ memory_id: memory.id, day: companion.current_day, excerpt: childText || conceptName }],
        confidence: 0.7,
      });
      // 3. 删除 unknown 行
      await deleteMemoryBankEntry(req.memoryId);
      correctionDetails = `孩子告诉我关于"${conceptName}"的事`;
      newUnderstanding = childText || `孩子主动给我讲了"${conceptName}"。`;
      newType = 'remembered';
      newConceptName = conceptName;
      // 反馈台词写到新创建的 remembered 行上
      await appendCorrectionHistory(remembered.id, {
        action: 'inform',
        at: new Date().toISOString(),
        payload: { from_unknown: req.memoryId, text: childText },
      });
      // 重写下面 conversations 关联到新 remembered，所以提前结束 case
      const feedbackInform = await runCorrection(
        {
          companion: preset,
          correctionType: 'inform',
          correctionDetails,
          oldUnderstanding,
          newUnderstanding,
        },
        companion.id,
      );
      await insertCompanionLine({
        companionId: companion.id,
        day: companion.current_day as DayNumber,
        content: feedbackInform,
        source: 'correction_feedback',
        relatedMemoryId: memory.id,
        relatedMemoryBankId: remembered.id,
      });
      return { feedback: feedbackInform, newType, newConceptName };
    }

    case 'withhold': {
      // 「我还不知道的事」上孩子选择"先不说" → 把 unknown 移到 set_aside（PRD §5.7.3）
      if (entry.type !== 'unknown') {
        throw new Error('withhold only applies to unknown');
      }
      newType = 'set_aside';
      await execute(
        `update memory_bank
           set type = 'set_aside',
               ai_summary = :sum,
               ai_reasoning = :rea,
               cache_dirty = true
           where id = :id`,
        {
          sum: `你选择不告诉我关于"${entry.concept_name}"的事。`,
          rea: '我问过你这个，你选择了先不说。这是你的权利。',
          id: req.memoryId,
        },
      );
      correctionDetails = `孩子选择不告诉我关于"${entry.concept_name}"的事`;
      newUnderstanding = `孩子明确选择不说。`;
      break;
    }

    default:
      throw new Error(`unsupported action ${req.action}`);
  }

  // 如果不是 merge（merge 已经在 target 上记 history），在原 entry 记 correction history
  if (req.action !== 'merge') {
    await appendCorrectionHistory(req.memoryId, {
      action: req.action,
      at: new Date().toISOString(),
      payload: req.params ?? {},
    });
  }

  // 调 LLM 生成反馈台词
  const feedback = await runCorrection(
    {
      companion: preset,
      correctionType: req.action,
      correctionDetails,
      oldUnderstanding,
      newUnderstanding,
    },
    companion.id,
  );

  // 写入 conversations
  await insertCompanionLine({
    companionId: companion.id,
    day: companion.current_day as DayNumber,
    content: feedback,
    source: 'correction_feedback',
    relatedMemoryBankId: req.action === 'merge' ? req.params?.targetMemoryId : req.memoryId,
  });

  return {
    feedback,
    newType,
    newConceptName,
  };
}
