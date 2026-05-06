/**
 * 广场剧本第 N 幕（PRD §14.7）
 *
 * 流程：
 *   1. 加载 plaza_play state（看历史 act_choices 是否合法）+ inventory + scenario
 *   2. 显示场景插画占位 + 剧本骨架的 scene 文本 + decision_prompt
 *   3. 孩子选 1 件道具（4 件可选 + "不用道具，凭直觉"）→ POST act
 *   4. LLM 生成 → 显示 narrative + 小青龙台词 + others 反应 + next_act_hook
 *   5. 第 1/2 幕 → "继续 →" 跳下一幕；第 3 幕 → "看结局 →" 跳 ending
 */

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { ScenarioIllustration } from '@/components/station/ScenarioIllustration';
import {
  getPlazaPlayState,
  getInventory,
  runPlazaAct,
  type InventoryItemView,
  type PlazaActResponse,
  type PlazaPlayStateResponse,
} from '@/lib/api/client';
import { listScenariosClient, getScenarioActSkeleton } from '@/lib/scenarioClient';

interface SetupData {
  state: PlazaPlayStateResponse;
  inventory: InventoryItemView[];
  applicableItemIds: string[];
}

export default function PlazaActPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id: playId, n } = use(params);
  const actNumber = Number(n) as 1 | 2 | 3;
  const router = useRouter();
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedRowId, setPickedRowId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actResult, setActResult] = useState<PlazaActResponse | null>(null);

  useEffect(() => {
    Promise.all([getPlazaPlayState(playId), getInventory()])
      .then(async ([state, inv]) => {
        if (state.finished) {
          router.replace(`/station/plaza/play/${encodeURIComponent(playId)}/ending`);
          return;
        }
        if (state.acts_done >= actNumber) {
          // 已完成的幕，直接显示结果
          const done = state.acts.find((a) => a.act === actNumber);
          if (done) {
            setSetup({
              state,
              inventory: inv.items,
              applicableItemIds: getScenarioActSkeleton(state.scenario_id, actNumber)
                ?.applicable_items ?? [],
            });
            setActResult({
              act: {
                scene_narrative: done.narrative ?? '',
                small_blue_dragon_speech: done.small_blue_dragon_speech ?? '',
                other_response: done.other_response ?? '',
                next_act_hook: done.next_act_hook ?? '',
                item_use_quality: done.quality ?? 'natural',
              },
              is_final_act: actNumber === 3,
              selected_item: done.item_id
                ? {
                    inventory_row_id: '',
                    item_id: done.item_id,
                    item_name:
                      inv.items.find((i) => i.item_id === done.item_id)?.name ??
                      done.item_id,
                  }
                : null,
            });
            return;
          }
        }
        // 顺序错位：当前幕应该是 acts_done+1
        if (actNumber !== state.acts_done + 1) {
          router.replace(
            `/station/plaza/play/${encodeURIComponent(playId)}/act/${
              state.acts_done + 1
            }`,
          );
          return;
        }
        setSetup({
          state,
          inventory: inv.items,
          applicableItemIds:
            getScenarioActSkeleton(state.scenario_id, actNumber)?.applicable_items ??
            [],
        });
      })
      .catch((e) => setError((e as Error)?.message ?? 'unknown'));
  }, [playId, actNumber, router]);

  const onUseItem = async (rowId: string | null) => {
    if (!setup || submitting) return;
    setPickedRowId(rowId);
    setSubmitting(true);
    try {
      const r = await runPlazaAct({
        play_id: playId,
        act_number: actNumber,
        item_row_id: rowId,
      });
      setActResult(r);
    } catch (e) {
      setError((e as Error)?.message ?? 'unknown');
      setSubmitting(false);
    }
  };

  const onContinue = () => {
    if (!actResult) return;
    if (actResult.is_final_act) {
      router.push(`/station/plaza/play/${encodeURIComponent(playId)}/ending`);
    } else {
      router.push(
        `/station/plaza/play/${encodeURIComponent(playId)}/act/${actNumber + 1}`,
      );
    }
  };

  if (error) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-title text-body text-ink-2 text-center">
            出了点问题：{error}
          </p>
          <Link href="/station">
            <Button>回驿站</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (!setup) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <span className="block w-10 h-10 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      </MobileShell>
    );
  }

  const { state, inventory, applicableItemIds } = setup;
  const skeleton = getScenarioActSkeleton(state.scenario_id, actNumber);

  // 道具列表：仅展示已拥有的；剧本适配项标 ●
  const itemsForPick: Array<{ row: InventoryItemView; applicable: boolean }> = inventory.map(
    (i) => ({
      row: i,
      applicable: applicableItemIds.includes(i.item_id),
    }),
  );

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/station" className="font-title text-small text-ink-3">
          ← 驿站
        </Link>
        <h1 className="font-title text-h3 text-ink-1">
          {state.scenario_title} · 第 {actNumber}/3 幕
        </h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        {/* 插画 */}
        <ScenarioIllustration
          scenarioId={state.scenario_id}
          actNumber={actNumber}
        />

        {/* 幕标题 + scene */}
        <section className="mt-4 mb-4">
          <p className="font-num text-mini text-amber-mid mb-1.5 tracking-[0.16em]">
            第 {actNumber} 幕 · {skeleton?.name ?? ''}
          </p>
          <p className="font-title text-body text-ink-1 leading-[1.7]">
            {skeleton?.scene ?? ''}
          </p>
        </section>

        {/* 决策点 / LLM 输出 */}
        {!actResult ? (
          <section>
            <p className="font-title text-h3 text-ink-1 mb-2">
              {skeleton?.decision_prompt ?? '你要让小青龙说什么？'}
            </p>
            {submitting ? (
              <ThinkingState />
            ) : (
              <>
                <p className="font-title text-small text-ink-3 mb-3">
                  从行囊里选一件道具帮它思考。
                </p>
                <div className="flex flex-col gap-2">
                  {itemsForPick.map(({ row, applicable }) => (
                    <button
                      key={row.id}
                      onClick={() => onUseItem(row.id)}
                      className={clsx(
                        'text-left rounded-card border-[1.5px] px-3 py-2.5 active:scale-[0.99] cursor-pointer flex items-center gap-3',
                        applicable
                          ? 'bg-white border-[rgba(186,117,23,0.4)]'
                          : 'bg-white border-[rgba(95,94,90,0.18)]',
                      )}
                    >
                      <span className="text-[20px] leading-none" aria-hidden>
                        {row.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-title text-body text-ink-1">
                          {applicable && '● '}
                          {row.name}
                        </p>
                        <p className="font-title text-mini text-ink-3 truncate">
                          {row.description}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => onUseItem(null)}
                    className="text-left rounded-card border-[1.5px] border-dashed border-[rgba(95,94,90,0.3)] px-3 py-2.5 active:scale-[0.99] cursor-pointer flex items-center gap-3 bg-white"
                  >
                    <span className="text-[20px] leading-none" aria-hidden>
                      ⚪
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-title text-body text-ink-1">
                        不用道具，凭直觉
                      </p>
                      <p className="font-title text-mini text-ink-3">
                        看小青龙怎么想
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <section>
            {/* 叙事 */}
            <article className="bg-white border-[1.2px] border-ink-2 rounded-card px-4 py-4 mb-3">
              <p className="font-title text-body text-ink-1 leading-[1.8] whitespace-pre-line">
                {actResult.act.scene_narrative}
              </p>
            </article>

            {/* 小青龙的核心台词高亮 */}
            <div className="bg-amber-light/30 border-[1.5px] border-amber-DEFAULT rounded-card px-4 py-3 mb-3">
              <p className="font-num text-mini text-amber-mid tracking-[0.16em] mb-1">
                小青龙
              </p>
              <p className="font-title text-h3 text-amber-deep leading-[1.6]">
                「{actResult.act.small_blue_dragon_speech}」
              </p>
            </div>

            {/* 其他角色反应 */}
            {actResult.act.other_response && (
              <div className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3 mb-3">
                <p className="font-title text-body text-ink-1 leading-[1.6]">
                  {actResult.act.other_response}
                </p>
              </div>
            )}

            {/* 道具使用质量小标 */}
            {actResult.act.item_use_quality === 'stretched' && (
              <p className="font-title text-mini text-ink-3 italic mb-2">
                （这件道具不太对路，小青龙绕了一下。）
              </p>
            )}
            {actResult.act.item_use_quality === 'skipped' && pickedRowId !== null && (
              <p className="font-title text-mini text-ink-3 italic mb-2">
                （它本来想拿出那件道具，但好像和这事没关系。）
              </p>
            )}
          </section>
        )}
      </div>

      {actResult && (
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
          <Button size="lg" fullWidth onClick={onContinue}>
            {actResult.is_final_act ? '看结局 →' : '继续 →'}
          </Button>
        </div>
      )}
    </MobileShell>
  );
}

function ThinkingState() {
  return (
    <div className="py-10 flex flex-col items-center gap-3">
      <span className="block w-12 h-12 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
      <p className="font-title text-body text-ink-2">小青龙在想......</p>
    </div>
  );
}
