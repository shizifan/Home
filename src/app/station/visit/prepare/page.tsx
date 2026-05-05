/**
 * 朋友家准备页（PRD §12.2 / §20.9）
 *
 * 4 个目的单选；选 ask_question 时展开"问什么"输入框。
 * 出发 → POST /api/station/depart → 跳 traveling 页（带 trip_id）
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { depart, type VisitPurpose } from '@/lib/api/client';

interface PurposeOption {
  id: VisitPurpose;
  title: string;
  hint: string;
  needs_question?: boolean;
}

const PURPOSES: PurposeOption[] = [
  {
    id: 'meet_friend',
    title: '去认识一个新朋友',
    hint: '它会带回这个朋友的样子',
  },
  {
    id: 'observe_home',
    title: '去看看朋友家是什么样的',
    hint: '它会观察那里和你家的不同',
  },
  {
    id: 'introduce_self',
    title: '去和朋友说说你自己',
    hint: '它会用你教它的事介绍你',
  },
  {
    id: 'ask_question',
    title: '去问朋友一件你好奇的事',
    hint: '你需要告诉它要问什么',
    needs_question: true,
  },
];

export default function VisitPreparePage() {
  const router = useRouter();
  const [purpose, setPurpose] = useState<VisitPurpose>('meet_friend');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = PURPOSES.find((p) => p.id === purpose)!;
  const canDepart =
    !submitting &&
    (!selected.needs_question || question.trim().length > 0);

  const onDepart = async () => {
    if (!canDepart) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await depart({
        trip_type: 'visit',
        purpose_type: purpose,
        purpose_question: selected.needs_question ? question.trim() : undefined,
      });
      router.push(`/station/traveling?trip_id=${encodeURIComponent(r.trip_id)}`);
    } catch (e) {
      const msg = (e as Error)?.message ?? 'unknown';
      const friendly =
        msg === 'daily_limit_reached'
          ? '今天已经出过门啦，明天再来吧。'
          : msg.startsWith('locked:')
            ? '这里还没解锁。'
            : msg === 'not_graduated'
              ? '它还没住满 7 天，不能出门。'
              : '出了点问题，再试一次？';
      setError(friendly);
      setSubmitting(false);
    }
  };

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/station" className="font-title text-small text-ink-3">
          ← 驿站
        </Link>
        <h1 className="font-title text-h3 text-ink-1">朋友家</h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32">
        <p className="font-title text-h2 text-ink-1 mb-5">你想让它去做什么？</p>

        <div className="flex flex-col gap-2.5">
          {PURPOSES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPurpose(p.id)}
              className={clsx(
                'text-left rounded-card border-[1.5px] px-4 py-3 transition active:scale-[0.99]',
                purpose === p.id
                  ? 'bg-amber-light/30 border-amber-DEFAULT'
                  : 'bg-white border-[rgba(95,94,90,0.18)]',
              )}
              aria-pressed={purpose === p.id}
            >
              <p
                className={clsx(
                  'font-title text-h3',
                  purpose === p.id ? 'text-amber-deep' : 'text-ink-1',
                )}
              >
                {purpose === p.id ? '● ' : '○ '}
                {p.title}
              </p>
              <p className="font-title text-small text-ink-3 mt-1 ml-5">
                {p.hint}
              </p>
            </button>
          ))}
        </div>

        {selected.needs_question && (
          <div className="mt-5">
            <label className="font-title text-small text-ink-2 mb-2 block">
              你想问什么？
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 80))}
              placeholder="比如：什么是大海？"
              rows={2}
              className="w-full border-[1.5px] border-[rgba(95,94,90,0.25)] rounded-card p-3 font-title text-body text-ink-1 bg-white outline-none focus:border-ink-2"
            />
            <div className="text-right font-num text-mini text-ink-3 mt-1">
              {question.length} / 80
            </div>
          </div>
        )}

        {error && (
          <p className="font-title text-small text-[#E24B4A] mt-4">{error}</p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        <Button size="lg" fullWidth onClick={onDepart} disabled={!canDepart}>
          {submitting ? '出发中......' : '出发 →'}
        </Button>
      </div>
    </MobileShell>
  );
}
