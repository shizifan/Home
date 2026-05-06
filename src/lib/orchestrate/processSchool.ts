/**
 * 学校课堂服务层（PRD §13 / §23.11）
 *
 * 串：assertCanDepart → 拼班级 → 选题（系统题或孩子出题）→ 建 trip → runSchool LLM → 写报告
 *
 * 与 visit 一样使用 fire-and-forget 异步模型：
 *   - startSchool 立即建 trip 返回
 *   - finishSchool 后台跑 LLM 写 trip.report_data
 */

import 'server-only';

import {
  createTrip,
  getCompanionById,
  getMemoryBank,
  getTripById,
  markTripReturned,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { assertCanDepart } from '@/lib/station/status';
import { pickClassRoster } from '@/lib/station/classRoster';
import {
  pickSystemQuestion,
  TEACHING_MOMENTS,
  type SystemQuestion,
} from '@/lib/station/questionBank';
import {
  presetToClassmate,
  renderVisitorMemorySummary,
  runSchool,
  schoolFallbackOutput,
  type ClassmateInput,
  type SchoolOutput,
} from '@/lib/llm/school';
import type { Trip, SchoolPurposeType } from '@/types';

export interface ProcessSchoolInput {
  companionId: string;
  purposeType: SchoolPurposeType;
  /** 仅 ask_my_question 必填 */
  purposeQuestion?: string;
}

export interface StartSchoolResult {
  trip: Trip;
  classmate_names: string[];
  question_text: string;
  question_source: 'system' | 'child';
}

function buildClassmates(args: {
  visitorPresetId: string;
  visitorName: string;
  visitorMemorySummary: string;
}): { classmates: ClassmateInput[] } {
  const roster = pickClassRoster(args.visitorPresetId, 4);
  const classmates: ClassmateInput[] = roster.map((p) => {
    if (p.preset_id === args.visitorPresetId) {
      // visitor 自己用真实 memory_bank 摘要替换默认
      return {
        presetId: p.preset_id,
        name: args.visitorName,
        appearance: p.appearance,
        personality: p.personality,
        memorySummary: args.visitorMemorySummary,
      };
    }
    return presetToClassmate(p);
  });
  return { classmates };
}

/**
 * 同步步：校验 + 选题 + 建 trip。立即返回 trip_id。
 */
export async function startSchool(
  input: ProcessSchoolInput,
): Promise<StartSchoolResult> {
  await assertCanDepart(input.companionId, 'school');

  if (
    input.purposeType === 'ask_my_question' &&
    !input.purposeQuestion?.trim()
  ) {
    throw new Error('ask_my_question_requires_question');
  }

  const companion = await getCompanionById(input.companionId);
  if (!companion) throw new Error('companion_not_found');

  // 选题：ask_my_question 用孩子的；其它走系统题库
  let questionText: string;
  let questionSource: 'system' | 'child';
  if (input.purposeType === 'ask_my_question' && input.purposeQuestion) {
    questionText = input.purposeQuestion.trim().slice(0, 80);
    questionSource = 'child';
  } else {
    const q = pickSystemQuestion(companion.preset_id);
    questionText = q.text;
    questionSource = 'system';
  }

  // 拼班级（仅为了拿到名字列表存进 trip.purpose_question）
  const visitorPreset = getCompanionPreset(companion.preset_id);
  if (!visitorPreset) throw new Error('visitor_preset_not_found');
  // 班级名字列表用作 fallback report；真正 LLM 拼接在 finishSchool 里
  const dummyMemorySummary = '（占位）';
  const { classmates } = buildClassmates({
    visitorPresetId: companion.preset_id,
    visitorName: companion.custom_name || visitorPreset.name,
    visitorMemorySummary: dummyMemorySummary,
  });

  const trip = await createTrip({
    companionId: companion.id,
    tripType: 'school',
    purposeType: input.purposeType,
    purposeQuestion: questionText, // 复用 trips.purpose_question 存当日题面
  });

  return {
    trip,
    classmate_names: classmates.map((c) => c.name),
    question_text: questionText,
    question_source: questionSource,
  };
}

/**
 * 异步步：跑 LLM 写报告。失败用 fallback 占位，不抛错。
 */
export async function finishSchool(args: {
  tripId: string;
  companionId: string;
  purposeType: SchoolPurposeType;
  questionText: string;
}): Promise<void> {
  try {
    const companion = await getCompanionById(args.companionId);
    if (!companion) throw new Error('companion_not_found');
    const visitorPreset = getCompanionPreset(companion.preset_id);
    if (!visitorPreset) throw new Error('visitor_preset_not_found');

    const visitorBank = await getMemoryBank(companion.id);
    const { classmates } = buildClassmates({
      visitorPresetId: companion.preset_id,
      visitorName: companion.custom_name || visitorPreset.name,
      visitorMemorySummary: renderVisitorMemorySummary(visitorBank),
    });

    const llm = await runSchool(
      {
        classmates,
        visitorName: companion.custom_name || visitorPreset.name,
        visitorPresetId: companion.preset_id,
        question: args.questionText,
        classPurpose: args.purposeType,
        teachingMomentsPool: TEACHING_MOMENTS,
      },
      companion.id,
    );

    const output: SchoolOutput = llm.success
      ? llm.data
      : schoolFallbackOutput(
          args.questionText,
          classmates.map((c) => c.name),
        );
    const source: 'llm' | 'fallback' = llm.success ? 'llm' : 'fallback';

    // PRD §13.6 "小青龙不会答"检测：visitor 自己的回答如果含"不知道"等关键词则标记
    const visitorName = companion.custom_name || visitorPreset.name;
    const visitorAnswer = output.answers.find(
      (a) => a.companion_name === visitorName,
    );
    const visitorDoesntKnow =
      !!visitorAnswer &&
      /不知道|没听过|没见过|没听说|不清楚|是什么/.test(visitorAnswer.answer);

    await markTripReturned({
      tripId: args.tripId,
      reportNarrative: output.highlight,
      reportData: {
        question: output.question,
        question_source:
          args.purposeType === 'ask_my_question' ? 'child' : 'system',
        answers: output.answers,
        highlight: output.highlight,
        teaching_moment: output.teaching_moment,
        classmates: classmates.map((c) => ({
          preset_id: c.presetId,
          name: c.name,
          appearance: c.appearance,
        })),
        visitor_doesnt_know: visitorDoesntKnow,
        visitor_name: visitorName,
        purpose: { type: args.purposeType },
        source,
      },
    });
  } catch (e) {
    console.error('[finishSchool]', e);
    await markTripReturned({
      tripId: args.tripId,
      reportNarrative: '它们今天没说太多。',
      reportData: {
        question: args.questionText,
        answers: [],
        highlight: '它们今天没说太多。',
        teaching_moment: null,
        source: 'fallback',
        error: (e as Error)?.message ?? 'unknown',
      },
    });
  }
}

/** 兼容同步入口（E2E / 测试用） */
export async function processSchool(input: ProcessSchoolInput) {
  const started = await startSchool(input);
  await finishSchool({
    tripId: started.trip.id,
    companionId: input.companionId,
    purposeType: input.purposeType,
    questionText: started.question_text,
  });
  const updated = await getTripById(started.trip.id);
  if (!updated) throw new Error('trip_disappeared_after_return');
  return updated;
}
