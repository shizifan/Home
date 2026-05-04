'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

const purposes = [
  {
    id: 'meet_friend',
    icon: '👋',
    title: '认识一个朋友',
    description: '随机认识一个已毕业的伙伴',
  },
  {
    id: 'observe_home',
    icon: '👀',
    title: '看看别人的家',
    description: '看看对方的家是什么样子',
  },
  {
    id: 'introduce_self',
    icon: '💬',
    title: '介绍你自己',
    description: '用你的记忆向对方介绍自己',
  },
  {
    id: 'ask_question',
    icon: '❓',
    title: '问一个问题',
    description: '向对方提一个问题，听听Ta的回答',
  },
];

export default function VisitPurposePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [departing, setDeparting] = useState(false);

  const handleDepart = async () => {
    if (!selected) return;
    setDeparting(true);

    try {
      const body: Record<string, string> = {
        trip_type: 'visit',
        purpose_type: selected,
      };
      if (selected === 'ask_question' && question.trim()) {
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
      router.push(`/station/visit/departing?trip_id=${data.trip_id}`);
    } catch (e) {
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
        <h1 className="font-title text-h2 text-ink-1 mt-3">拜访朋友家</h1>
        <p className="font-title text-small text-ink-3 mt-1">
          选择一个拜访目的
        </p>
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
                <p className="font-title text-mini text-ink-3 mt-0.5">
                  {p.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected === 'ask_question' && (
        <div className="mx-5 mt-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="输入你想问的问题..."
            className="w-full h-[80px] rounded-card border border-[rgba(95,94,90,0.2)] p-3 font-title text-body text-ink-1 bg-bg-base resize-none focus:outline-none focus:border-amber-deep"
            maxLength={100}
          />
        </div>
      )}

      <div className="px-5 mt-8 mb-8">
        <button
          onClick={handleDepart}
          disabled={!selected || departing || (selected === 'ask_question' && !question.trim())}
          className="w-full h-[52px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
        >
          {departing ? '出发中...' : '🚪 出发'}
        </button>
      </div>
    </MobileShell>
  );
}
