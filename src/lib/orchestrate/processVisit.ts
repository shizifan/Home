/**
 * 朋友家拜访流程编排
 * 
 * 流程：
 * 1. 匹配对方伙伴
 * 2. 收集双方 memory_bank 摘要
 * 3. 调用 LLM visit callType 生成拜访报告
 * 4. 如果有 new_word，写入 memory_bank（二手知识）
 * 5. 更新 trip 记录
 */

import 'server-only';

import { callLLM } from '@/lib/llm/client';
import { getCompanionById, getMemoryBank, upsertMemoryBankEntry, completeTrip } from '@/lib/db/repos';
import { matchCompanion } from '@/lib/station/matching';
import { renderCompanionHome } from '@/lib/station/renderHome';
import { renderPrompt } from '@/lib/llm/promptLoader';
import type { EvidenceItem } from '@/types';
import { filterChildInput, filterCompanionOutput } from '@/lib/safety/filters';

function getVisitSystemPrompt(): string {
  return renderPrompt('visit', {});
}

interface VisitReport {
  scene_narrative: string;
  observation: string;
  highlights: string[];
  new_word?: {
    concept: string;
    source_type: string;
    source_companion: string;
    confidence: number;
  };
}

export async function processVisit(args: {
  tripId: string;
  companionId: string;
  purposeType: string;
  purposeQuestion?: string;
}): Promise<{
  reportNarrative: string;
  reportData: VisitReport;
  destinationCompanionId: string;
  destinationCompanionName: string;
  renderedHome: unknown;
}> {
  const { tripId, companionId, purposeType, purposeQuestion } = args;

  // 1. 匹配对方伙伴
  const myCompanion = await getCompanionById(companionId);
  if (!myCompanion) throw new Error('Companion not found');

  const destination = await matchCompanion(companionId);

  // 2. 收集双方 memory_bank 摘要
  const myBank = await getMemoryBank(companionId);
  const theirBank = await getMemoryBank(destination.id);

  const mySummary = myBank.slice(0, 15).map((m) => ({
    concept: m.concept_name,
    summary: m.ai_summary ?? m.concept_name,
    category: m.concept_category,
  }));

  const theirSummary = theirBank.slice(0, 15).map((m) => ({
    concept: m.concept_name,
    summary: m.ai_summary ?? m.concept_name,
    category: m.concept_category,
  }));

  // 3. 渲染对方家（用于前端展示）
  const renderedHome = await renderCompanionHome(destination.id);

  // 4. 构建 LLM prompt（先做输入安全过滤）
  if (purposeQuestion) {
    const inputCheck = filterChildInput(purposeQuestion);
    if (!inputCheck.ok) {
      throw new Error('输入包含不宜内容，请换个方式提问。');
    }
  }
  const userPrompt = JSON.stringify({
    我方: {
      name: myCompanion.custom_name || '小青龙',
      memory_bank: mySummary,
    },
    对方: {
      name: destination.custom_name || '伙伴',
      memory_bank: theirSummary,
    },
    目的: purposeType,
    ...(purposeType === 'ask_question' && purposeQuestion
      ? { 问题: purposeQuestion }
      : {}),
  });

  // 5. 调用 LLM
  const result = await callLLM<VisitReport>({
    callType: 'visit',
    systemPrompt: getVisitSystemPrompt(),
    userPrompt,
    expectJson: true,
    parse: (raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.scene_narrative || !parsed.observation) return null;
        return parsed as VisitReport;
      } catch {
        return null;
      }
    },
    companionId,
    promptVersion: 'visit-v1',
  });

  let report: VisitReport;
  if (result.success) {
    report = result.data;
    // 输出安全过滤
    const narrativeCheck = filterCompanionOutput(report.scene_narrative);
    if (!narrativeCheck.ok) {
      report.scene_narrative = `小青龙来到了${destination.custom_name || '伙伴'}的家。门一打开，里面是一个温馨的小窝。`;
    }
  } else {
    // 降级：使用基础模板
    report = {
      scene_narrative: `小青龙来到了${destination.custom_name || '伙伴'}的家。门一打开，里面是一个温馨的小窝。`,
      observation: `对方的家里摆满了各种各样的东西，和我们的家很不一样。`,
      highlights: ['每只伙伴的家都很独特', '了解了不同伙伴眼中的世界'],
    };
  }

  // 6. 如果有 new_word，写入二手知识
  if (report.new_word) {
    await upsertMemoryBankEntry({
      companionId,
      type: 'remembered',
      conceptName: report.new_word.concept,
      confidence: report.new_word.confidence ?? 0.3,
      sourceType: 'secondhand',
      sourceCompanionId: destination.id,
      aiSummary: `从${report.new_word.source_companion}那里听说的`,
      evidence: [
        {
          quote: report.new_word.concept,
          day: 0,
          source: 'visit',
          at: new Date().toISOString(),
        } as EvidenceItem,
      ],
    });
  }

  // 7. 更新 trip 记录
  const narrative = `「拜访${destination.custom_name || '伙伴'}的家」\n\n${report.scene_narrative}\n\n${report.observation}`;
  await completeTrip(tripId, narrative, {
    purpose_type: purposeType,
    report: report as unknown as Record<string, unknown>,
  });

  return {
    reportNarrative: narrative,
    reportData: report,
    destinationCompanionId: destination.id,
    destinationCompanionName: destination.custom_name || '伙伴',
    renderedHome,
  };
}
