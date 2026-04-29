/**
 * InformDialog — 「我还不知道的事」点击后的小弹层
 * 二选一：「告诉它」（输入文字）或「先不说」
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  conceptName: string;
  companionName: string;
  onCancel: () => void;
  onInform: (text: string) => void | Promise<void>;
  onWithhold: () => void | Promise<void>;
}

export function InformDialog({
  conceptName,
  companionName,
  onCancel,
  onInform,
  onWithhold,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submitInform = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onInform(text.trim());
    } finally {
      setBusy(false);
    }
  };

  const submitWithhold = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onWithhold();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} aria-hidden />
      <div className="relative w-full bg-bg-base rounded-t-sheet shadow-sheet px-7 pt-5 pb-9">
        <div className="flex justify-center mb-1.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="bg-transparent border-0 p-2 cursor-pointer"
          >
            <span className="block w-11 h-[5px] bg-[rgba(95,94,90,0.35)] rounded-full" />
          </button>
        </div>

        <p className="font-title text-mini text-ink-3 mb-1">关于</p>
        <h2 className="font-title text-h1 text-ink-1 mb-3">{conceptName}</h2>
        <p className="font-title text-small text-ink-2 mb-4 leading-relaxed">
          告诉{companionName}吧，让它知道这是什么。<br />
          也可以先不说——这是你的选择。
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          placeholder={`比如：${conceptName}是……`}
          rows={4}
          disabled={busy}
          className="w-full border-[1.5px] border-[rgba(95,94,90,0.25)] rounded-[12px] p-3 font-title text-body text-ink-1 bg-white resize-none outline-none focus:border-ink-2 leading-[1.6] disabled:opacity-60"
        />
        <div className="flex justify-end mt-1 px-1">
          <span className="font-num text-mini text-ink-3">{text.length} / 300</span>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <Button size="lg" fullWidth onClick={submitInform} disabled={busy || !text.trim()}>
            {busy ? `${companionName}在听…` : '告诉它'}
          </Button>
          <Button variant="ghost" fullWidth onClick={submitWithhold} disabled={busy}>
            先不说
          </Button>
        </div>
      </div>
    </div>
  );
}
