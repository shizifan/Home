/**
 * 小区广场流程编排
 * 
 * 流程：
 * 1. 加载剧本数据
 * 2. processPlazaAct：执行单幕 → 调 LLM plaza_act
 * 3. processPlazaEnding：汇总三幕 → 调 LLM plaza_ending → 写入 inventory_items
 */

import 'server-only';

import { callLLM } from '@/lib/llm/client';
import { getCompanionById, addInventoryItem, updatePlazaPlay, completeTrip } from '@/lib/db/repos';
import { query } from '@/lib/db/client';
import fs from 'fs';
import path from 'path';
import { renderPrompt } from '@/lib/llm/promptLoader';
import type { ActChoice, EarnedItem, InventoryItem } from '@/types';
import { filterChildInput, filterCompanionOutput } from '@/lib/safety/filters';

function getPlazaActSystemPrompt(): string {
  return renderPrompt('plaza_act', {});
}

function getPlazaEndingSystemPrompt(): string {
  return renderPrompt('plaza_ending', {});
}

export interface ScenarioData {
  id: string;
  title: string;
  synopsis: string;
  roles: string[];
  companion_role_map: Record<string, string>;
  acts: Array<{
    act: number;
    title: string;
    setting: string;
    dilemma: string;
    choices: string[];
  }>;
  endings: Record<string, { condition: string; narrative_template: string }>;
}

export interface PlazaActResult {
  act_number: number;
  scene_narrative: string;
  companion_speech: string;
  reactions: string;
  item_use_quality: 'clever' | 'reasonable' | 'barely_relevant';
  remaining_items: Array<{ item_id: string; item_name: string }>;
}

export interface PlazaEndingResult {
  ending_type: 'perfect' | 'good' | 'barely';
  narrative: string;
  earned_items: EarnedItem[];
  upgraded_items?: Array<{ from_id: string; from_name: string; to_id: string; to_name: string }>;
}

export function loadScenario(scenarioId: string): ScenarioData {
  const filePath = path.join(
    process.cwd(),
    'data/scenarios',
    `${scenarioId}.json`,
  );
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function getAllScenarioIds(): string[] {
  const dir = path.join(process.cwd(), 'data/scenarios');
  const files = fs.readdirSync(dir);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

export async function processPlazaAct(args: {
  companionId: string;
  scenarioId: string;
  actNumber: number;
  selectedItemId: string | null;
  selectedItemName?: string;
  previousActs: ActChoice[];
}): Promise<PlazaActResult> {
  const { companionId, scenarioId, actNumber, selectedItemId, selectedItemName, previousActs } = args;

  const myCompanion = await getCompanionById(companionId);
  if (!myCompanion) throw new Error('Companion not found');

  const scenario = loadScenario(scenarioId);
  const act = scenario.acts.find((a) => a.act === actNumber);
  if (!act) throw new Error(`Act ${actNumber} not found in scenario ${scenarioId}`);

  const role = scenario.companion_role_map[myCompanion.preset_id as string] || scenario.roles[0];
  const myName = myCompanion.custom_name || '小青龙';

  // 获取剩余道具（用于返回给前端）
  const inventory = await query<{ item_id: string; item_name: string }>(
    `select item_id, item_name from inventory_items
     where companion_id = $1
       and item_id not in (${previousActs.map((_, i) => `$${i + 2}`).join(',') || `'$NONE$'`})
       and item_id != $${previousActs.length + 2}`,
    [companionId, ...previousActs.map((a) => a.selected_item_id ?? ''), selectedItemId ?? ''],
  );
  const remainingItems = inventory.map((item) => ({
    item_id: item.item_id,
    item_name: item.item_name,
  }));

  const userPrompt = JSON.stringify({
    scenario: { title: scenario.title, synopsis: scenario.synopsis, setting: act.setting },
    current_act: { act_number: act.act, dilemma: act.dilemma },
    selected_item: selectedItemId
      ? { item_id: selectedItemId, item_name: selectedItemName || '道具', item_description: '' }
      : null,
    previous_acts: previousActs,
    companion: { name: myName, role, personality: myCompanion.starting_personality },
  });

  // 输入安全过滤
  const promptCheck = filterChildInput(userPrompt);
  if (!promptCheck.ok) {
    throw new Error('输入包含不宜内容，请换个方式提问。');
  }

  const result = await callLLM<PlazaActResult>({
    callType: 'plaza_act',
    systemPrompt: getPlazaActSystemPrompt(),
    userPrompt,
    expectJson: true,
    parse: (raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.scene_narrative || !parsed.companion_speech) return null;
        return {
          act_number: actNumber,
          scene_narrative: parsed.scene_narrative,
          companion_speech: parsed.companion_speech,
          reactions: parsed.reactions || '',
          item_use_quality: parsed.item_use_quality || 'reasonable',
          remaining_items: remainingItems,
        };
      } catch {
        return null;
      }
    },
    companionId,
    promptVersion: 'plaza_act-v1',
  });

  if (result.success) {
    result.data.remaining_items = remainingItems;
    // 输出安全过滤
    const narrativeCheck = filterCompanionOutput(result.data.scene_narrative);
    if (!narrativeCheck.ok) {
      result.data.scene_narrative = `${act.setting}`;
    }
    const speechCheck = filterCompanionOutput(result.data.companion_speech);
    if (!speechCheck.ok) {
      result.data.companion_speech = `（${myName}作为${role}仔细思考着对策...）`;
    }
    return result.data;
  }

  // 降级
  return {
    act_number: actNumber,
    scene_narrative: `${act.setting}`,
    companion_speech: `（${myName}作为${role}仔细思考着对策...）`,
    reactions: '众大臣纷纷议论，等待丞相的决断。',
    item_use_quality: 'reasonable',
    remaining_items: remainingItems,
  };
}

export async function processPlazaEnding(args: {
  companionId: string;
  tripId: string;
  plazaPlayId: string;
  scenarioId: string;
  allActs: ActChoice[];
}): Promise<PlazaEndingResult> {
  const { companionId, tripId, plazaPlayId, scenarioId, allActs } = args;

  const myCompanion = await getCompanionById(companionId);
  if (!myCompanion) throw new Error('Companion not found');

  const scenario = loadScenario(scenarioId);
  const role = scenario.companion_role_map[myCompanion.preset_id as string] || scenario.roles[0];

  // 判断结局类型
  const cleverCount = allActs.filter((a) => a.item_use_quality === 'clever').length;
  let endingType: 'perfect' | 'good' | 'barely';
  if (cleverCount >= 3) endingType = 'perfect';
  else if (cleverCount >= 1) endingType = 'good';
  else endingType = 'barely';

  const myName = myCompanion.custom_name || '小青龙';

  // 调 LLM 生成结局
  const userPrompt = JSON.stringify({
    scenario: { title: scenario.title },
    all_acts: allActs,
    companion: { name: myName, role },
  });

  const result = await callLLM<PlazaEndingResult>({
    callType: 'plaza_ending',
    systemPrompt: getPlazaEndingSystemPrompt(),
    userPrompt,
    expectJson: true,
    parse: (raw) => {
      try {
        const parsed = JSON.parse(raw);
        return {
          ending_type: endingType,
          narrative: parsed.narrative || '',
          earned_items: parsed.earned_items || [],
          upgraded_items: parsed.upgraded_items,
        };
      } catch {
        return null;
      }
    },
    companionId,
    promptVersion: 'plaza_ending-v1',
  });

  let ending: PlazaEndingResult;
  if (result.success) {
    ending = result.data;
    // 输出安全过滤
    const narrativeCheck = filterCompanionOutput(ending.narrative);
    if (!narrativeCheck.ok) {
      ending.narrative = '游戏结束了，但你们的回忆会一直留在这里。';
    }
  } else {
    ending = {
      ending_type: endingType,
      narrative: scenario.endings[endingType]?.narrative_template || '游戏结束了。',
      earned_items: [],
    };
  }

  // 写入获得的道具
  for (const item of ending.earned_items) {
    await addInventoryItem({
      companionId,
      itemId: item.item_id,
      itemName: item.item_name,
      itemCategory: item.category || 'object',
      itemDescription: item.item_name,
      itemDetailedDescription: `通过${scenario.title}获得`,
      acquiredFrom: `plaza_${scenarioId}`,
    });
  }

  // 处理道具升级
  if (ending.upgraded_items) {
    for (const upgrade of ending.upgraded_items) {
      // 简单实现：添加升级后的新道具
      await addInventoryItem({
        companionId,
        itemId: upgrade.to_id,
        itemName: upgrade.to_name,
        itemCategory: 'knowledge',
        itemSubcategory: 'upgraded',
        itemDescription: `${upgrade.from_name} 升级版`,
        itemDetailedDescription: `由${upgrade.from_name}升级而来，效果更强。`,
        acquiredFrom: `plaza_${scenarioId}`,
        upgradedFrom: upgrade.from_id,
      });
    }
  }

  // 更新 plaza_plays 记录
  await updatePlazaPlay(plazaPlayId, {
    actChoices: allActs,
    endingType: ending.ending_type,
    endingNarrative: ending.narrative,
    earnedItems: ending.earned_items,
  });

  // 更新 trip 记录
  const narrative = `「${scenario.title}」· ${ending.ending_type === 'perfect' ? '完美结局' : ending.ending_type === 'good' ? '好结局' : '结局'}\n\n${ending.narrative}`;
  await completeTrip(tripId, narrative, {
    scenario: scenarioId,
    ending: ending as unknown as Record<string, unknown>,
  });

  return ending;
}
