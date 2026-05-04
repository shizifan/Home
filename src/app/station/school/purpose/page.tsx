'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

const purposes = [
  {
    id: 'attend_class',
    icon: '📖',
    title: '去上课',
    description: '老师出题，看看每只伙伴如何回答',
  },
  {
    id: 'ask_my_question',
    icon: '🙋',
    title: '问我的问题',
    description: '你自己出题，看大家如何看待',
  },
  {
    id: 'observe_others',
    icon: '👀',
    title: '观察别人',
    description: '观察同学们之间的差异',
  },
  {
    id: 'learn_new',
    icon: '💡',
    title: '学点新东西',
    description: '从其他伙伴那里学习新知',
  },
];

export default function SchoolPurposePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [departing, setDeparting] = useState(false);

  const handleDepart = async () => {
    if (!selected) return;
    setDeparting(true);

    try {
      const body: Record<string, string> = {
        trip_type: 'school',
        purpose_type: selected,
      };
      if (selected === 'ask_my_question' && question.trim()) {
        body.purpose_question = question.trim();
      }

      const r = await fetch('/api/station/depart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        alert(err.error ?? '出发失败');
        setDeparting(false);
        return;
      }

      const data = await r.json();
      router.push(`/station/school/departing?trip_id=${data.trip_id}`);
    } catch {
      alert('出发失败，请重试');
      setDeparting(false);
    }
  };

  return (
    <MobileShell>
      <div className="px-5 pt-6 pb-4">
        <button
          onClick={() => router.push('/station/map')}
          className="font-title text-small text-ink-3 flex items-center gap-1 cursor-pointer"
        >
          ← 返回地图
        </button>
        <h1 className="font-title text-h2 text-ink-1 mt-3">去学校</h1>
        <p className="font-title text-small text-ink-3 mt-1">选择课堂活动</p>
      </div>

      <div className="px-5 flex flex-col gap-3">
        {purposes.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`w-full text-left rounded-card border p-4 transition ${
              selected === p.id
                ? 'border-amber-deep bg-amber-light/20'
                : 'border-[rgba(95,94,90,0.1)] bg-bg-base'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <h3 className="font-title text-body text-ink-1">{p.title}</h3>
                <p className="font-title text-mini text-ink-3 mt-0.5">{p.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected === 'ask_my_question' && (
        <div className="mx-5 mt-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="输入你的问题..."
            className="w-full h-[80px] rounded-card border border-[rgba(95,94,90,0.2)] p-3 font-title text-body text-ink-1 bg-bg-base resize-none focus:outline-none focus:border-amber-deep"
            maxLength={100}
          />
        </div>
      )}

      <div className="px-5 mt-8 mb-8">
        <button
          onClick={handleDepart}
          disabled={!selected || departing || (selected === 'ask_my_question' && !question.trim())}
          className="w-full h-[52px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
        >
          {departing ? '出发中...' : '🚪 出发'}
        </button>
      </div>
    </MobileShell>
  );
}
