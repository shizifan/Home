/**
 * TranscriptionConfirm — ASR 中转页（V0.6.1 §4.3.4）
 *
 * 收到 ASR 转写结果后的中间确认环节：
 *   - 展示识别结果（可编辑）
 *   - 「改一下」 → contentEditable / textarea
 *   - 「重新说」 → 清空，回到 VoiceRecorder
 *   - 「我说的就是这个」 → 提交，进入生成阶段
 *
 * 不实装「再加一段」（V0.6.1 §13 待决议 B2，默认不做）
 *
 * 必须主动确认（决议 B4），不做 5 秒自动跳过。
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  /** ASR 返回的初始文字 */
  initialText: string;
  onConfirm: (finalText: string) => void;
  onRedo: () => void;
  /** 是否在提交中（外部禁用按钮）*/
  submitting?: boolean;
}

export function TranscriptionConfirm({
  initialText,
  onConfirm,
  onRedo,
  submitting,
}: Props) {
  const [text, setText] = useState(initialText);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const trimmed = text.trim();
  const canConfirm = trimmed.length > 0 && !submitting;

  return (
    <div className="flex flex-col gap-4" data-testid="transcription-confirm">
      <p className="font-title text-h3 text-ink-1">我听到你说：</p>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 600))}
          rows={5}
          autoFocus
          className="w-full min-h-[140px] bg-white border border-[#D3D1C7] rounded-[12px] px-4 py-3 font-title text-body text-ink-1 leading-[1.8] outline-none focus:border-ink-2 resize-none"
        />
      ) : (
        <div
          className="bg-white border border-[#D3D1C7] rounded-[12px] px-4 py-3 cursor-text"
          onClick={() => !submitting && setEditing(true)}
        >
          <p className="font-title text-body text-ink-1 leading-[1.8] whitespace-pre-wrap min-h-[60px]">
            {text || '（空）'}
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={submitting}
          onClick={() => setEditing(true)}
          className="bg-white border border-[rgba(95,94,90,0.25)] rounded-full px-3.5 py-2 font-title text-small text-ink-2 cursor-pointer disabled:opacity-50"
        >
          ✏️ 改一下
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onRedo}
          className="bg-white border border-[rgba(95,94,90,0.25)] rounded-full px-3.5 py-2 font-title text-small text-ink-2 cursor-pointer disabled:opacity-50"
        >
          🎤 重新说
        </button>
      </div>

      <p className="font-title text-mini text-ink-3 mt-1">内容对吗？</p>

      <Button
        size="lg"
        fullWidth
        disabled={!canConfirm}
        onClick={() => onConfirm(trimmed)}
      >
        {submitting ? '让我想想…' : '我说的就是这个 →'}
      </Button>
    </div>
  );
}
