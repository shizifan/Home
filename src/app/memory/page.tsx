/**
 * 记忆面板（PRD §5）
 * P3 + polish：
 *   - 4 区块真数据
 *   - 概念卡 ⋮ 菜单 → /memory/concept/[id]
 *   - 拿不准 → /memory/clarify/[id]
 *   - 放下的事 → restore / confirm-joke（已确认隐藏按钮）
 *   - 不知道的事 → InformDialog → inform / withhold
 *   - 「还不知道的事」由 /api/memory/bank 自动 LLM 生成
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { CompanionFeedbackToast } from '@/components/ui/CompanionFeedbackToast';
import {
  ConceptCard,
  PanelHeader,
  SectionHeader,
  SetAsideCard,
  UncertainCard,
  UnknownCard,
} from '@/components/memory/cards';
import { InformDialog } from '@/components/memory/InformDialog';
import { useCompanionStore } from '@/stores/companionStore';
import { useUIStore } from '@/stores/uiStore';
import {
  completeTask,
  correctMemory,
  getCompanionState,
  getMemoryBank,
  presetCompanionDisplayName,
  type CompanionStateResponse,
  type MemoryBankCardData,
  type MemoryBankResponse,
} from '@/lib/api/client';
import type { ConceptCategory } from '@/types';

export default function MemoryPanelPage() {
  const router = useRouter();
  const { companionId } = useCompanionStore();
  const { setUnreadMemory } = useUIStore();
  const [state, setState] = useState<CompanionStateResponse | null>(null);
  const [bank, setBank] = useState<MemoryBankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [informTarget, setInformTarget] = useState<{ id: string; name: string } | null>(null);

  const reload = async () => {
    const [s, b] = await Promise.all([getCompanionState(), getMemoryBank()]);
    setState(s);
    setBank(b);
    setUnreadMemory(false);
  };

  useEffect(() => {
    if (!companionId) {
      router.replace('/');
      return;
    }
    reload()
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [companionId, router, setUnreadMemory]);

  const runAction = async (
    args: Parameters<typeof correctMemory>[0],
    onAfter?: () => void,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await correctMemory(args);
      setFeedback(r.feedback);
      // P1 fix: Day 6 任务的完成判定 — 任意一次纠正动作即标记完成
      if (state?.companion?.current_day === 6 && !state.today_done) {
        try {
          await completeTask({ task_id: 'day6_review' });
        } catch {
          // 标记失败不阻塞纠正流程
        }
      }
      await reload();
      onAfter?.();
    } catch (e) {
      setFeedback((e as Error)?.message ?? '出了点问题');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">让它整理一下脑袋…</p>
        </div>
      </MobileShell>
    );
  }
  if (!state?.companion || !bank) return null;

  const displayName = state.companion.display_name;
  const totalConcepts =
    bank.remembered.length + bank.uncertain.length + bank.set_aside.length + bank.unknown.length;

  return (
    <MobileShell>
      <PanelHeader companionName={displayName} onBack={() => router.back()} />

      <div
        className="px-4 pb-24 pt-2 overflow-y-auto"
        style={{ height: 'calc(100dvh - 44px - 56px - 70px)' }}
      >
        {/* P1 fix: Day 6 任务横幅（PRD §5.6 / §8.9）*/}
        {state?.companion?.current_day === 6 && !state.today_done && (
          <div className="bg-amber-light/30 border-[1.5px] border-amber-DEFAULT rounded-card px-4 py-3 mt-2 mb-3">
            <p className="font-num text-mini text-amber-mid tracking-[0.16em] mb-1">
              今天的事
            </p>
            <p className="font-title text-h3 text-amber-deep mb-1">
              帮{displayName}整理一下
            </p>
            <p className="font-title text-small text-ink-2 leading-relaxed">
              它有些事拿不准、有些可能记错了。
              <br />
              做一次纠正（捡回 / 让它放下 / 解释），今天就完成了。
            </p>
          </div>
        )}
        {state?.companion?.current_day === 6 && state.today_done && (
          <div className="bg-[rgba(151,196,89,0.18)] border border-[rgba(59,109,17,0.3)] rounded-card px-4 py-2.5 mt-2 mb-3">
            <p className="font-title text-small text-[#3B6D11]">
              ✓ 今天的整理任务已完成。回主页可以推进 Day 7。
            </p>
          </div>
        )}

        {totalConcepts === 0 && (
          <div className="bg-white/60 rounded-card px-4 py-8 mt-4 text-center">
            <p className="font-title text-h3 text-ink-2 mb-2">还啥都没有呢</p>
            <p className="font-title text-small text-ink-3 leading-relaxed">
              你给{displayName}讲点什么，<br />
              它的脑袋里就会慢慢有东西。
            </p>
          </div>
        )}

        {bank.remembered.length > 0 && (
          <>
            <SectionHeader
              color="#F0997B"
              icon="heart"
              title="我记住的东西"
              count={bank.remembered.length}
            />
            {bank.remembered.map((c) => (
              <ConceptCard
                key={c.id}
                color="#F0997B"
                iconBg="#F0997B"
                iconText={categoryLabel(c.concept_category)}
                name={c.concept_name}
                summary={c.ai_summary || '（还没有理解）'}
                evidence={(c.evidence ?? []).map((e) => `Day ${e.day}: ${e.excerpt}`)}
                onMenu={() => router.push(`/memory/concept/${c.id}`)}
                secondhandFrom={
                  c.source_type === 'secondhand'
                    ? presetCompanionDisplayName(c.source_companion_id) ?? '另一只朋友'
                    : undefined
                }
              />
            ))}
          </>
        )}

        {bank.uncertain.length > 0 && (
          <>
            <SectionHeader
              color="#AFA9EC"
              icon="q"
              title="我有点拿不准的事"
              count={bank.uncertain.length}
            />
            {bank.uncertain.map((u) => (
              <UncertainCard
                key={u.id}
                title={`关于「${u.concept_name}」`}
                body={u.ai_reasoning || u.ai_summary || ''}
                onClarify={() => router.push(`/memory/clarify/${u.id}`)}
              />
            ))}
          </>
        )}

        {bank.set_aside.length > 0 && (
          <>
            <SectionHeader
              color="#85B7EB"
              icon="moon"
              title="我决定先放一放的事"
              count={bank.set_aside.length}
            />
            {bank.set_aside.map((s) => (
              <SetAsideCard
                key={s.id}
                title={s.concept_name}
                quote={s.ai_summary || ''}
                reason={s.ai_reasoning || ''}
                confirmed={isConfirmedSetAside(s)}
                onRestore={() => runAction({ memory_id: s.id, action: 'restore' })}
                onConfirm={() => runAction({ memory_id: s.id, action: 'dismiss' })}
              />
            ))}
          </>
        )}

        {bank.unknown.length > 0 && (
          <>
            <SectionHeader color="#888780" icon="fog" title="我还不知道的事" />
            <UnknownCard
              items={bank.unknown.map((u) => ({ id: u.id, name: u.concept_name }))}
              onPick={(item) => setInformTarget(item)}
            />
          </>
        )}

        <p className="font-title text-mini text-ink-3 text-center pt-6 pb-2">
          ─ 这就是它脑袋里的全部了 ─
        </p>
      </div>

      <div className="absolute left-0 right-0 bottom-0 h-[70px] bg-[#FFF8EA] border-t border-[rgba(95,94,90,0.15)] flex justify-center items-center">
        <Button onClick={() => router.push('/home')}>回到小家</Button>
      </div>

      {feedback && (
        <CompanionFeedbackToast
          text={feedback}
          companionName={displayName}
          onClose={() => setFeedback(null)}
        />
      )}

      {informTarget && (
        <InformDialog
          conceptName={informTarget.name}
          companionName={displayName}
          onCancel={() => setInformTarget(null)}
          onInform={async (text) => {
            await runAction(
              {
                memory_id: informTarget.id,
                action: 'inform',
                params: { clarification: text },
              },
              () => setInformTarget(null),
            );
          }}
          onWithhold={async () => {
            await runAction(
              { memory_id: informTarget.id, action: 'withhold' },
              () => setInformTarget(null),
            );
          }}
        />
      )}
    </MobileShell>
  );
}

/**
 * 已被孩子确认 "就是开玩笑" 的 set_aside：correction_history 里有任意一次 dismiss
 */
function isConfirmedSetAside(s: MemoryBankCardData): boolean {
  if (!Array.isArray(s.user_correction_history)) return false;
  return s.user_correction_history.some((h) => h.action === 'dismiss');
}

function categoryLabel(cat?: ConceptCategory | string): string {
  switch (cat) {
    case 'person':
      return '人';
    case 'place':
      return '地';
    case 'food':
      return '食';
    case 'activity':
      return '事';
    case 'object':
      return '物';
    case 'emotion':
      return '心';
    default:
      return '·';
  }
}
