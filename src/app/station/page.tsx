/**
 * 驿站地图页 /station（PRD §11.4 / §20.8）
 *
 * 进入条件：companion 已毕业（worldview 已生成）。
 * 未毕业时引导回主页。
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { StationMap } from '@/components/station/StationMap';
import { getStationStatus, type StationStatusResponse } from '@/lib/api/client';

export default function StationPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStationStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const onPick = (slot: 'visit' | 'school' | 'plaza') => {
    if (slot === 'visit') router.push('/station/visit/prepare');
    else if (slot === 'school') router.push('/station/school/prepare');
    else router.push('/station/plaza/prepare');
  };

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/home" className="font-title text-small text-ink-3">
          ← 回小家
        </Link>
        <h1 className="font-title text-h3 text-ink-1">驿站</h1>
        <span aria-hidden className="w-12" />
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="block w-10 h-10 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && !status && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-title text-body text-ink-2 text-center">
            还没有伙伴入住，先回小家选一个伙伴吧。
          </p>
          <Link href="/home">
            <Button>回小家</Button>
          </Link>
        </div>
      )}

      {!loading && status && !status.graduated && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-title text-body text-ink-2 text-center leading-relaxed">
            它还没住满 7 天呢。
            <br />
            等住满 7 天，就可以一起出门了。
          </p>
          <Link href="/home">
            <Button>回小家</Button>
          </Link>
        </div>
      )}

      {!loading && status && status.graduated && (
        <StationMap status={status} onPick={onPick} />
      )}
    </MobileShell>
  );
}
