/**
 * 澄清对话页（PRD §5.5.3）
 * 用户面对 uncertain 卡，输入澄清 → 调 correct API (action='clarify')
 * → 该项移到 remembered + 伙伴反馈
 */

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import {
  correctMemory,
  getCompanionState,
  getMemoryBank,
  type MemoryBankCardData,
} from '@/lib/api/client';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClarifyPage id={id} />;
}

function ClarifyPage({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<MemoryBankCardData | null>(null);
  const [companionName, setCompanionName] = useState('伙伴');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<'input' | 'reply' | 'error'>('input');
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMemoryBank(), getCompanionState()]).then(([b, s]) => {
      const found =
        b.uncertain.find((u) => u.id === id) ||
        b.remembered.find((u) => u.id === id) ||
        b.set_aside.find((u) => u.id === id);
      setEntry(found ?? null);
      setCompanionName(s.companion?.display_name ?? '伙伴');
    });
  }, [id]);

  const submit = async () => {
    const clarification = text.trim();
    if (!clarification || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await correctMemory({
        memory_id: id,
        action: 'clarify',
        params: { clarification },
      });
      setReply(r.feedback);
      setStage('reply');
    } catch (e) {
      setError((e as Error)?.message ?? '出了点问题，再试一次');
      setStage('error');
      setSubmitting(false);
    }
  };

  if (!entry) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">找不到这条疑问…</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <header className="px-4 py-3 flex items-center gap-2 border-b border-[rgba(95,94,90,0.12)]">
        <button
          onClick={() => router.back()}
          aria-label="返回"
          className="bg-transparent border-0 p-1 cursor-pointer"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <path
              d="M14 4 L7 11 L14 18"
              stroke="#2C2C2A"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <h1 className="font-title text-h2 text-ink-1">告诉它真实的感受</h1>
      </header>

      <div className="flex flex-col px-5 pt-5 pb-8" style={{ minHeight: 'calc(100dvh - 44px - 56px)' }}>
        {/* 伙伴的疑问气泡 */}
        <div className="bg-m-uncertain/15 border border-m-uncertain/60 rounded-card p-4 mb-4">
          <p className="font-title text-mini text-ink-3 mb-1.5">{companionName}有点拿不准：</p>
          <p className="font-title text-h3 text-ink-1 mb-1">「{entry.concept_name}」</p>
          <p className="font-title text-body text-ink-2 leading-[1.6]">
            {entry.ai_reasoning || entry.ai_summary}
          </p>
        </div>

        {stage === 'input' && (
          <>
            <p className="font-title text-small text-ink-3 mb-2">告诉它你真实的感受：</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder="慢慢说，多写一点也没关系……"
              rows={6}
              className="w-full border-[1.5px] border-[rgba(95,94,90,0.25)] rounded-[12px] p-3.5 font-title text-body text-ink-1 bg-white resize-none outline-none focus:border-ink-2 leading-[1.6]"
            />
            <div className="flex justify-between mt-1.5 px-1">
              <span className="font-title text-mini text-ink-3">字数不限，写到合适为止</span>
              <span className="font-num text-mini text-ink-3">{text.length} / 300</span>
            </div>

            {error && (
              <p className="font-title text-small text-[#E24B4A] mt-2">{error}</p>
            )}

            <div className="flex-1" />

            <div className="flex gap-3 mt-6">
              <Button variant="ghost" fullWidth onClick={() => router.back()}>
                先不说了
              </Button>
              <Button fullWidth onClick={submit} disabled={!text.trim() || submitting}>
                {submitting ? `${companionName}正在听…` : '告诉它'}
              </Button>
            </div>
          </>
        )}

        {stage === 'reply' && reply && (
          <>
            <div className="bg-white border-[1.2px] border-ink-2 rounded-[14px] p-4 mt-2">
              <p className="font-title text-mini text-ink-3 mb-1.5">— {companionName}</p>
              <p className="font-title text-body text-ink-1 leading-[1.6]">「{reply}」</p>
            </div>
            <div className="flex-1" />
            <Button size="lg" fullWidth onClick={() => router.replace('/memory')}>
              回到它的脑袋
            </Button>
          </>
        )}

        {stage === 'error' && (
          <>
            <p className="font-title text-body text-[#E24B4A] mt-2">{error}</p>
            <div className="flex-1" />
            <Button size="lg" fullWidth onClick={() => setStage('input')}>
              再试一次
            </Button>
          </>
        )}
      </div>
    </MobileShell>
  );
}
