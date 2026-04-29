/**
 * 选伙伴页（PRD §11.2.3）
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { Companion } from '@/components/characters/Companion';
import { COMPANION_PRESETS } from '@/lib/companionPresets';
import type { CompanionPresetId } from '@/components/characters/types';

export default function ChoosePage() {
  const router = useRouter();
  const [picked, setPicked] = useState<CompanionPresetId | null>(null);
  const [confirming, setConfirming] = useState(false);

  const pickedMeta = picked ? COMPANION_PRESETS.find((p) => p.preset_id === picked) : null;

  const confirm = () => {
    if (!pickedMeta) return;
    router.push(`/onboarding/name?preset=${pickedMeta.preset_id}`);
  };

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-6 pt-8 pb-8">
        <div>
          <h1 className="font-title text-h1 text-ink-1">选一个搬进 Home 的伙伴</h1>
          <p className="font-title text-small text-ink-3 mt-2">
            后续你也可以上传自己的玩具（即将开放）
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6 flex-1 overflow-y-auto pb-4">
          {COMPANION_PRESETS.map((p) => (
            <button
              key={p.preset_id}
              onClick={() => setPicked(p.preset_id)}
              className={`bg-white rounded-card border-[1.5px] transition px-3 pt-3 pb-2 flex flex-col items-center gap-1 ${
                picked === p.preset_id
                  ? 'border-ink-1 shadow-[0_4px_0_#5F5E5A]'
                  : 'border-[rgba(95,94,90,0.18)]'
              }`}
            >
              <div className="h-[110px] flex items-end">
                <Companion presetId={p.preset_id} pose="stand" size={100} />
              </div>
              <span className="font-title text-h3 text-ink-1">{p.name}</span>
              <span className="font-title text-mini text-ink-3 text-center leading-tight">{p.personality}</span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          {pickedMeta ? (
            <Button size="lg" fullWidth onClick={() => setConfirming(true)}>
              选 {pickedMeta.name} 一起开始 7 天
            </Button>
          ) : (
            <Button size="lg" fullWidth disabled>
              先选一个伙伴
            </Button>
          )}
        </div>
      </div>

      {confirming && pickedMeta && (
        <ConfirmModal
          name={pickedMeta.name}
          onCancel={() => setConfirming(false)}
          onOk={confirm}
        />
      )}
    </MobileShell>
  );
}

function ConfirmModal({
  name,
  onCancel,
  onOk,
}: {
  name: string;
  onCancel: () => void;
  onOk: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div className="relative w-full bg-bg-base rounded-t-sheet px-7 pt-6 pb-9 shadow-sheet">
        <h2 className="font-title text-h2 text-ink-1">确定让 {name} 入住吗？</h2>
        <p className="font-title text-small text-ink-3 mt-2">
          它会在你的小家住 7 天。这期间它只属于你们俩。
        </p>
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" fullWidth onClick={onCancel}>
            再想想
          </Button>
          <Button fullWidth onClick={onOk}>
            就是它
          </Button>
        </div>
      </div>
    </div>
  );
}
