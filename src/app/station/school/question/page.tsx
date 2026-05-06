/**
 * 学校出题页（PRD §13.2 / §13.7）
 *
 * 孩子输入想问的题目，提交前服务端做敏感词过滤。
 * 提交成功后跳 traveling 页等课堂回放。
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { depart } from '@/lib/api/client';

const MAX_LEN = 60;

export default function SchoolQuestionPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const canSubmit = trimmed.length >= 2 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await depart({
        trip_type: 'school',
        purpose_type: 'ask_my_question',
        purpose_question: trimmed,
      });
      router.push(`/station/traveling?trip_id=${encodeURIComponent(r.trip_id)}`);
    } catch (e) {
      const err = e as Error & { friendlyMessage?: string };
      const code = err.message;
      let friendly: string;
      if (code === 'question_blocked_by_safety') {
        friendly = err.friendlyMessage ?? '这个问题我不太好传达，换一个试试？';
      } else if (code === 'daily_limit_reached') {
        friendly = '今天已经出过门啦。';
      } else if (code === 'ask_my_question_requires_question') {
        friendly = '问题写一下吧。';
      } else {
        friendly = '出了点问题，再试一次？';
      }
      setError(friendly);
      setSubmitting(false);
    }
  };

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link
          href="/station/school/prepare"
          className="font-title text-small text-ink-3"
        >
          ← 选目的
        </Link>
        <h1 className="font-title text-h3 text-ink-1">出题</h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32">
        <p className="font-title text-h2 text-ink-1 mb-2">你想让它问什么？</p>
        <p className="font-title text-small text-ink-3 mb-5 leading-relaxed">
          它会把这个题带到学校，让所有同学都答一遍——你能看到它们答案的不同。
        </p>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX_LEN));
            setError(null);
          }}
          placeholder="比如：什么是大海？ / 周末通常做什么？"
          rows={3}
          className="w-full border-[1.5px] border-[rgba(95,94,90,0.25)] rounded-card p-3 font-title text-body text-ink-1 bg-white outline-none focus:border-ink-2"
        />
        <div className="text-right font-num text-mini text-ink-3 mt-1">
          {text.length} / {MAX_LEN}
        </div>

        {error && (
          <p className="font-title text-small text-[#E24B4A] mt-4">{error}</p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        <Button size="lg" fullWidth onClick={onSubmit} disabled={!canSubmit}>
          {submitting ? '出发中......' : '出发 →'}
        </Button>
      </div>
    </MobileShell>
  );
}
