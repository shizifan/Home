/**
 * 概念详情页（PRD §10.4）
 * 显示 understanding / reasoning / 整理后的 evidence + 操作菜单：
 *   - 让它放下这件事 (dismiss)
 *   - 改名（rename）— P3 polish
 *   - 合并（merge）— P3 polish
 */

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { CompanionFeedbackToast } from '@/components/ui/CompanionFeedbackToast';
import {
  correctMemory,
  getCompanionState,
  getConceptDetail,
  type ConceptDetailResponse,
} from '@/lib/api/client';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ConceptDetail id={id} />;
}

function ConceptDetail({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ConceptDetailResponse | null>(null);
  const [companionName, setCompanionName] = useState<string>('伙伴');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    Promise.all([getConceptDetail(id), getCompanionState()])
      .then(([d, s]) => {
        setDetail(d);
        setCompanionName(s.companion?.display_name ?? '伙伴');
        setNewName(d.concept_name);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  const dismiss = async () => {
    if (busy) return;
    if (!confirm(`让${companionName}放下"${detail?.concept_name}"这件事吗？`)) return;
    setBusy(true);
    try {
      const r = await correctMemory({ memory_id: id, action: 'dismiss' });
      setFeedback(r.feedback);
      setTimeout(() => router.replace('/memory'), 1500);
    } catch (e) {
      setFeedback((e as Error)?.message ?? '出了点问题');
      setBusy(false);
    }
  };

  const submitRename = async () => {
    if (busy) return;
    const name = newName.trim();
    if (!name || name === detail?.concept_name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      const r = await correctMemory({
        memory_id: id,
        action: 'rename',
        params: { newName: name },
      });
      setFeedback(r.feedback);
      setRenaming(false);
      // 重新拉详情
      const d = await getConceptDetail(id);
      setDetail(d);
    } catch (e) {
      setFeedback((e as Error)?.message ?? '改名出了点问题');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">让{companionName}想想…</p>
        </div>
      </MobileShell>
    );
  }
  if (!detail) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 gap-4">
          <p className="font-title text-h3 text-ink-2">没找到这个概念</p>
          <Button onClick={() => router.replace('/memory')}>回到脑袋</Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <header className="px-4 py-3 flex items-center gap-2 border-b border-[rgba(95,94,90,0.12)]">
        <button
          onClick={() => router.back()}
          aria-label="返回"
          className="bg-transparent border-0 p-1 cursor-pointer"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <path
              d="M14 4 L7 11 L14 18"
              stroke="#2C2C2A"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {!renaming ? (
          <h1 className="font-title text-h2 text-ink-1 flex-1">{detail.concept_name}</h1>
        ) : (
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value.slice(0, 60))}
            className="flex-1 bg-white border-[1.5px] border-ink-2 rounded-card px-3 py-1 font-title text-h3 text-ink-1 outline-none"
            autoFocus
          />
        )}
        {!renaming ? (
          <button
            onClick={() => setRenaming(true)}
            className="font-title text-small text-amber bg-transparent border-0 cursor-pointer"
          >
            改名
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setRenaming(false);
                setNewName(detail.concept_name);
              }}
              className="font-title text-small text-ink-3 bg-transparent border-0 cursor-pointer mr-2"
            >
              取消
            </button>
            <button
              onClick={submitRename}
              disabled={busy}
              className="font-title text-small text-amber bg-transparent border-0 cursor-pointer"
            >
              确定
            </button>
          </>
        )}
      </header>

      <div
        className="px-5 pb-24 pt-4 overflow-y-auto"
        style={{ height: 'calc(100dvh - 44px - 56px - 80px)' }}
      >
        <div className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card p-4 mb-4">
          <p className="font-title text-mini text-ink-3 mb-1.5">我对它的理解</p>
          <p className="font-title text-body text-ink-1 leading-[1.6]">
            {detail.understanding}
          </p>
        </div>

        {detail.reasoning && (
          <div className="bg-amber-light/30 border border-amber-light rounded-card p-4 mb-4">
            <p className="font-title text-mini text-amber-mid mb-1.5">我是这样想的</p>
            <p className="font-title text-body text-amber-deep leading-[1.6]">
              {detail.reasoning}
            </p>
          </div>
        )}

        <div className="mt-2">
          <p className="font-title text-mini text-ink-3 mb-2">我用到的证据：</p>
          {(detail.evidence_rephrased.length > 0
            ? detail.evidence_rephrased
            : detail.raw_evidence.map((e) => ({ day: e.day, text: e.excerpt }))
          ).map((e, i) => (
            <div
              key={i}
              className="bg-white/60 rounded-card px-3 py-2 mb-1.5 border border-[rgba(95,94,90,0.1)]"
            >
              <p className="font-title text-small text-ink-2">
                <span className="font-num text-amber-mid mr-2">Day {e.day}</span>
                {e.text}
              </p>
            </div>
          ))}
        </div>

        {detail.source === 'fallback' && (
          <p className="font-title text-mini text-ink-3 text-center mt-4">
            （它有点累，先看证据吧）
          </p>
        )}
      </div>

      <div className="absolute left-0 right-0 bottom-0 h-[80px] bg-[#FFF8EA] border-t border-[rgba(95,94,90,0.15)] flex justify-center items-center px-5">
        <Button variant="danger" onClick={dismiss} disabled={busy} fullWidth>
          让它放下这件事
        </Button>
      </div>

      {feedback && (
        <CompanionFeedbackToast
          text={feedback}
          companionName={companionName}
          onClose={() => setFeedback(null)}
        />
      )}
    </MobileShell>
  );
}
