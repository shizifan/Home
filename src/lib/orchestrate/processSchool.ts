/**
 * 学校课堂流程编排
 * 
 * 流程：
 * 1. 选取问题（题库随机或孩子自定义）
 * 2. 匹配班级成员
 * 3. 收集所有成员 memory_bank
 * 4. 调用 LLM school callType 生成课堂报告
 * 5. 匹配教学时刻
 * 6. 更新 trip 记录
 */

import 'server-only';

import { callLLM } from '@/lib/llm/client';
import { getCompanionById, getMemoryBank, completeTrip } from '@/lib/db/repos';
import { matchSchoolClass } from '@/lib/station/matching';
import fs from 'fs';
import path from 'path';
import { renderPrompt } from '@/lib/llm/promptLoader';
import { filterChildInput, filterCompanionOutput } from '@/lib/safety/filters';

function getSchoolSystemPrompt(): string {
  return renderPrompt('school', {});
}

interface SchoolQuestion {
  id: string;
  question: string;
  teaching_hint?: string;
  category: string;
}

interface SchoolReport {
  question: string;
  answers: Array<{
    companion: string;
    answer: string;
    basis?: string;
  }>;
  highlight: string;
  teaching_moment: string;
}

interface TeachingMoment {
  id: string;
  text: string;
  category: string;
  tags: string[];
}

export async function processSchool(args: {
  tripId: string;
  companionId: string;
  purposeType: string;
  purposeQuestion?: string;
}): Promise<{
  reportNarrative: string;
  reportData: SchoolReport;
  question: SchoolQuestion;
}> {
  const { tripId, companionId, purposeType, purposeQuestion } = args;

  const myCompanion = await getCompanionById(companionId);
  if (!myCompanion) throw new Error('Companion not found');

  // 1. 选取问题
  let question: SchoolQuestion;
  if (purposeType === 'ask_my_question' && purposeQuestion) {
    const inputCheck = filterChildInput(purposeQuestion);
    if (!inputCheck.ok) {
      throw new Error('输入包含不宜内容，请换个方式提问。');
    }
    question = {
      id: 'custom',
      question: purposeQuestion,
      teaching_hint: undefined,
      category: 'custom',
    };
  } else {
    // 从题库随机选
    question = getRandomQuestion(purposeType === 'attend_class');
  }

  // 2. 匹配班级成员
  const classmates = await matchSchoolClass(companionId, 4);
  const allMembers = [myCompanion, ...classmates.slice(0, 3)]; // 总共 4 人

  // 3. 收集所有成员 memory_bank
  const bankPromises = allMembers.map(async (c) => {
    const bank = await getMemoryBank(c.id);
    return {
      name: c.custom_name || '伙伴',
      memory_bank_summary: bank.slice(0, 10).map((m) => ({
        concept: m.concept_name,
        summary: m.ai_summary ?? m.concept_name,
        category: m.concept_category,
      })),
    };
  });
  const companionsData = await Promise.all(bankPromises);

  // 4. 调用 LLM
  const userPrompt = JSON.stringify({
    question: question.question,
    companions: companionsData,
  });

  const result = await callLLM<SchoolReport>({
    callType: 'school',
    systemPrompt: getSchoolSystemPrompt(),
    userPrompt,
    expectJson: true,
    parse: (raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.question || !Array.isArray(parsed.answers)) return null;
        return parsed as SchoolReport;
      } catch {
        return null;
      }
    },
    companionId,
    promptVersion: 'school-v1',
  });

  let report: SchoolReport;
  if (result.success) {
    report = result.data;
    // 输出安全过滤
    const highlightCheck = filterCompanionOutput(report.highlight);
    if (!highlightCheck.ok) {
      report.highlight = '每只伙伴对这个问题都有不同的看法。';
    }
    const teachingCheck = filterCompanionOutput(report.teaching_moment);
    if (!teachingCheck.ok) {
      report.teaching_moment = 'AI 回答不同的问题，是因为它们见过的东西不一样。';
    }
  } else {
    report = {
      question: question.question,
      answers: companionsData.map((c) => ({
        companion: c.name,
        answer: '这个问题很有意思...',
        basis: '',
      })),
      highlight: '每只伙伴对这个问题都有不同的看法。',
      teaching_moment: 'AI 回答不同的问题，是因为它们见过的东西不一样。',
    };
  }

  // 5. 匹配教学时刻
  const teachingMoment = getTeachingMoment(report.answers.length);
  report.teaching_moment = teachingMoment;

  // 6. 更新 trip 记录
  const narrative = `「课堂：${question.question}」\n\n${report.answers
    .map((a) => `${a.companion}说：${a.answer}`)
    .join('\n\n')}\n\n${report.highlight}\n\n\x1b[34m${report.teaching_moment}\x1b[0m`;

  await completeTrip(tripId, narrative, {
    purpose_type: purposeType,
    question: question,
    report: report as unknown as Record<string, unknown>,
  });

  return {
    reportNarrative: narrative,
    reportData: report,
    question,
  };
}

function getRandomQuestion(preferAI: boolean): SchoolQuestion {
  const questions = getQuestions();
  if (preferAI) {
    const aiQuestions = questions.filter((q) => q.category === 'ai_literacy');
    if (aiQuestions.length > 0) {
      return aiQuestions[Math.floor(Math.random() * aiQuestions.length)];
    }
  }
  return questions[Math.floor(Math.random() * questions.length)];
}

function getQuestions(): SchoolQuestion[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'data/system_questions.json'),
      'utf-8',
    );
    const data = JSON.parse(raw);
    return [...(data.category_a || []), ...(data.category_b || [])];
  } catch {
    return [
      { id: 'fallback1', question: '什么样的人通常当医生？', teaching_hint: undefined, category: 'ai_literacy' },
      { id: 'fallback2', question: '如果森林里下雨，小动物会躲在哪里？', teaching_hint: undefined, category: 'fun' },
    ];
  }
}

function getTeachingMoment(answersCount: number): string {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'data/teaching_moments.json'),
      'utf-8',
    );
    const moments: TeachingMoment[] = JSON.parse(raw);
    // 根据答案数量做一个简单的映射，保证每次选到的教学时刻有变化
    const idx = (answersCount * 3 + new Date().getDate()) % moments.length;
    return moments[idx]?.text ?? 'AI 回答不同的问题，是因为它们见过的东西不一样。';
  } catch {
    return 'AI 回答不同的问题，是因为它们见过的东西不一样。';
  }
}
