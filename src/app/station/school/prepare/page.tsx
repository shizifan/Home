/**
 * 学校准备页（PRD §13.2 / §20.10‑style）
 *
 * 4 个目的单选；选 ask_my_question 时下一步进 /station/school/question 输入题面。
 * 其它 3 目的直接 depart → traveling。
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { depart, type SchoolPurpose } from '@/lib/api/client';

interface PurposeOption {
  id: SchoolPurpose;
  title: string;
  hint: string;
  needs_question?: boolean;
}

const PURPOSES: PurposeOption[] = [
  {
    id: 'attend_class',
    title: '去上一堂课',
    hint: '今天的题目老师定，看大家怎么答',
  },
  {
    id: 'ask_my_question',
    title: '去问一个你想问的问题',
    hint: '你出题，看不同朋友怎么答',
    needs_question: true,
  },
  {
    id: 'observe_others',
    title: '去看看其他人是什么样的',
    hint: '它会观察其他朋友的不同',
  },
  {
    id: 'learn_new',
    title: '去学一个你不知道的东西',
    hint: '它会从其他朋友那里学新知识',
  },
];

export default function SchoolPreparePage() {
  const router = useRouter();
  const [purpose, setPurpose] = useState<SchoolPurpose>('attend_class');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = PURPOSES.find((p) => p.id === purpose)!;

  const onPrimary = async () => {
    if (selected.needs_question) {
      // 跳出题页面再发车
      router.push('/station/school/question');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await depart({
        trip_type: 'school',
        purpose_type: purpose,
      });
      router.push(`/station/traveling?trip_id=${encodeURIComponent(r.trip_id)}`);
    } catch (e) {
      const msg = (e as Error)?.message ?? 'unknown';
      const friendly =
        msg === 'daily_limit_reached'
          ? '今天已经出过门啦，明天再来吧。'
          : msg.startsWith('locked:')
            ? '学校还没解锁——先去拜访 2 次朋友。'
            : msg === 'not_graduated'
              ? '它还没住满 7 天，不能上学。'
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
        <h1 className="font-title text-h3 text-ink-1">学校</h1>
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
              <p className="font-title text-small text-ink-3 mt-1 ml-5">{p.hint}</p>
            </button>
          ))}
        </div>

        {error && (
          <p className="font-title text-small text-[#E24B4A] mt-4">{error}</p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        <Button size="lg" fullWidth onClick={onPrimary} disabled={submitting}>
          {submitting
            ? '出发中......'
            : selected.needs_question
              ? '想想要问什么 →'
              : '出发 →'}
        </Button>
      </div>
    </MobileShell>
  );
}
