/**
 * 家长中心算术软门槛（PRD §20.14）
 *
 * 防止 8 岁孩子误进设置页（重置数据等）。不是真的安全，仅"小防御"。
 * 通过后写 sessionStorage，本会话内不再询问。
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { MobileShell } from '@/components/ui/MobileShell';

const STORAGE_KEY = 'home.parent_guard_passed';

interface Question {
  text: string;
  answer: number;
}

const QUESTIONS: Question[] = [
  { text: '3 + 5 = ?', answer: 8 },
  { text: '7 + 6 = ?', answer: 13 },
  { text: '9 + 4 = ?', answer: 13 },
  { text: '12 - 5 = ?', answer: 7 },
  { text: '8 + 7 = ?', answer: 15 },
];

function pickQuestion(): Question {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

export function ParentGuard({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [passed, setPassed] = useState(false);
  const [question, setQuestion] = useState<Question>(() => pickQuestion());
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v === '1') setPassed(true);
    } catch {
      // sessionStorage 不可用就一直问
    }
  }, []);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = Number(input.trim());
    if (!Number.isFinite(n)) {
      setError('请输入一个数字');
      return;
    }
    if (n !== question.answer) {
      setError('再算一次？');
      setInput('');
      setQuestion(pickQuestion()); // 答错换一题，避免暴力重试
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setPassed(true);
  };

  // SSR 阶段不渲染门槛，避免 hydration mismatch
  if (!hydrated) return null;
  if (passed) return <>{children}</>;

  return (
    <MobileShell>
      <div className="min-h-dvh flex flex-col items-center justify-center px-8 gap-6">
        <h1 className="font-title text-h2 text-ink-1 text-center">家长中心</h1>
        <p className="font-title text-body text-ink-2 text-center max-w-[280px] leading-relaxed">
          为了避免误进，请回答下面这道算术题。
        </p>
        <form onSubmit={onSubmit} className="w-full flex flex-col items-center gap-3">
          <div className="font-num text-h1 text-ink-1 tracking-wider">{question.text}</div>
          <input
            type="number"
            inputMode="numeric"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            autoFocus
            className="w-32 text-center font-num text-h2 text-ink-1 bg-white border-[1.5px] border-ink-2 rounded-card py-2 outline-none focus:border-amber-DEFAULT"
            aria-label="算术题答案"
          />
          {error && <p className="font-title text-small text-[#E24B4A]">{error}</p>}
          <Button type="submit" size="lg" disabled={input.trim().length === 0}>
            进入
          </Button>
        </form>
      </div>
    </MobileShell>
  );
}
