'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface StationStatus {
  friendHouseUnlocked: boolean;
  schoolUnlocked: boolean;
  plazaUnlocked: boolean;
  dailyDeparturesRemaining: number;
}

export default function StationMapPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/station/status');
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">加载中...</p>
        </div>
      </MobileShell>
    );
  }

  if (!status) return null;

  const canDepart = status.dailyDeparturesRemaining > 0;

  const locations = [
    {
      id: 'visit',
      icon: '🏠',
      name: '朋友家',
      subtitle: '一对一 · 拜访了解',
      unlocked: status.friendHouseUnlocked,
      unlockHint: '7天毕业后解锁',
      route: '/station/visit/purpose',
    },
    {
      id: 'school',
      icon: '📚',
      name: '学校',
      subtitle: '一对多 · 课堂对比',
      unlocked: status.schoolUnlocked,
      unlockHint: '拜访朋友家2次后解锁',
      route: '/station/school/purpose',
    },
    {
      id: 'plaza',
      icon: '🎭',
      name: '小区广场',
      subtitle: '角色扮演 · 道具系统',
      unlocked: status.plazaUnlocked,
      unlockHint: '上学1次后解锁',
      route: '/station/plaza/prep',
    },
  ];

  return (
    <MobileShell>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <button
          onClick={() => router.push('/home')}
          className="font-title text-small text-ink-3 flex items-center gap-1 cursor-pointer"
        >
          ← 返回小屋
        </button>
        <h1 className="font-title text-h2 text-ink-1 mt-3">伙伴驿站地图</h1>
        <p className="font-title text-small text-ink-3 mt-1">
          选择一个地方出发吧
        </p>
      </div>

      {/* Location cards */}
      <div className="px-5 flex flex-col gap-4">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className={`rounded-card border p-5 ${
              loc.unlocked
                ? 'bg-bg-base border-amber-light cursor-pointer active:scale-[0.98] transition-transform'
                : 'bg-bg-base border-[rgba(95,94,90,0.1)] opacity-60'
            }`}
            onClick={() => {
              if (loc.unlocked && canDepart) {
                router.push(loc.route);
              }
            }}
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl">{loc.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-title text-h3 text-ink-1">{loc.name}</h2>
                  {!loc.unlocked && <span className="text-lg">🔒</span>}
                </div>
                <p className="font-title text-small text-ink-3 mt-1">
                  {loc.subtitle}
                </p>
                {loc.unlocked ? (
                  canDepart ? (
                    <div className="mt-3">
                      <span className="font-title text-mini text-amber-deep bg-amber-light/30 px-3 py-1 rounded-full">
                        去{loc.name === '小区广场' ? '玩' : '拜访'}
                      </span>
                    </div>
                  ) : (
                    <p className="font-title text-mini text-ink-3 mt-3">
                      明天再来吧
                    </p>
                  )
                ) : (
                  <p className="font-title text-mini text-ink-3 mt-3">
                    {loc.unlockHint}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily counter */}
      <div className="mx-5 mt-6 mb-4 p-4 bg-amber-light/20 rounded-card text-center">
        <p className="font-title text-body text-amber-deep">
          {canDepart
            ? `今天还可以出门 ${status.dailyDeparturesRemaining} 次`
            : '今天已经出过门了，明天再来吧'}
        </p>
      </div>

      {/* Backpack link */}
      <div className="px-5 mb-8">
        <button
          onClick={() => router.push('/station/backpack')}
          className="w-full h-[48px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer"
        >
          🎒 查看行囊
        </button>
      </div>
    </MobileShell>
  );
}
