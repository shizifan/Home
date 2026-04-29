/**
 * 命名页（PRD §11.2.4）
 * 通过 ?preset=xxx 传入选定的 preset；提交时 POST /api/companion/create。
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { Companion } from '@/components/characters/Companion';
import { useCompanionStore } from '@/stores/companionStore';
import { getCompanionPreset } from '@/lib/companionPresets';
import { createCompanion } from '@/lib/api/client';
import { COMPANION_PRESET_IDS, type CompanionPresetId } from '@/components/characters/types';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NamePageInner />
    </Suspense>
  );
}

function NamePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const presetParam = search.get('preset');

  const validPreset =
    presetParam && (COMPANION_PRESET_IDS as readonly string[]).includes(presetParam)
      ? (presetParam as CompanionPresetId)
      : null;

  const { setCompanionId } = useCompanionStore();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validPreset) router.replace('/onboarding/choose');
  }, [validPreset, router]);

  if (!validPreset) return null;

  const preset = getCompanionPreset(validPreset);
  if (!preset) return null;

  const submit = async (useDefault: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const finalName = useDefault ? '' : name.trim();
      const r = await createCompanion({
        preset_id: validPreset,
        custom_name: finalName || undefined,
      });
      setCompanionId(r.companion.id);
      router.push('/home');
    } catch (e) {
      setError((e as Error)?.message ?? '出了点问题');
      setSubmitting(false);
    }
  };

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-7 pt-10 pb-10">
        <div>
          <h1 className="font-title text-h1 text-ink-1">给它一个名字吧</h1>
          <p className="font-title text-small text-ink-3 mt-2">也可以保留它原来的名字</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <Companion presetId={validPreset} pose="stand" size={170} />
          <p className="font-title text-h3 text-ink-2 mt-2">原来叫「{preset.name}」</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="输入名字…"
            disabled={submitting}
            className="mt-8 w-full max-w-[280px] bg-white border-b-[1.5px] border-[rgba(95,94,90,0.4)] focus:border-ink-1 outline-none px-1 py-3 font-title text-h2 text-ink-1 text-center disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="font-title text-small text-[#E24B4A] text-center mb-3">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth onClick={() => submit(false)} disabled={submitting}>
            {submitting ? '正在迎它进门…' : name.trim() ? '这就是它的名字' : `就叫${preset.name}`}
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
