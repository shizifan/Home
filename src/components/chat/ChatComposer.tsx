/**
 * ChatComposer — ChatOverlay 底部输入栏
 *
 * - Enter 发送 / Shift+Enter 换行
 * - pending 期间禁用 + 按钮文字变"…正在思考"
 * - maxlength=200，由父组件保证乐观 UI 顺序
 */

'use client';

import { useState, useRef } from 'react';
import clsx from 'clsx';

const MAX_LEN = 200;

interface Props {
  pending: boolean;
  onSend: (question: string) => Promise<void>;
  placeholder?: string;
}

export function ChatComposer({ pending, onSend, placeholder = '问问它…' }: Props) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const canSend = !pending && trimmed.length > 0;

  const fire = async () => {
    if (!canSend) return;
    const q = trimmed;
    setText('');
    // textarea 高度复位
    if (taRef.current) taRef.current.style.height = 'auto';
    await onSend(q);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void fire();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.slice(0, MAX_LEN);
    setText(v);
    // autoresize：1–3 行
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  return (
    <div className="shrink-0 border-t border-[rgba(95,94,90,0.15)] bg-bg-base px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          disabled={pending}
          aria-label="输入问题"
          className={clsx(
            'flex-1 resize-none bg-white border-[1.5px] rounded-[14px] px-3.5 py-2.5',
            'font-title text-body text-ink-1 leading-[1.5] outline-none',
            'border-[rgba(95,94,90,0.25)] focus:border-ink-2',
            'disabled:bg-[rgba(95,94,90,0.06)] disabled:text-ink-3',
            'min-h-[42px] max-h-[96px]',
          )}
        />
        <button
          type="button"
          onClick={fire}
          disabled={!canSend}
          aria-label={pending ? '正在思考' : '发送'}
          className={clsx(
            'shrink-0 h-[42px] px-4 rounded-full font-title text-small cursor-pointer border-0',
            'bg-amber-light text-amber-deep',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            pending && 'min-w-[110px]',
          )}
        >
          {pending ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 inline-block rounded-full border-[2px] border-amber-deep border-t-transparent animate-spin" />
              正在思考
            </span>
          ) : (
            '发送'
          )}
        </button>
      </div>
      <div className="flex justify-end mt-1">
        <span className="font-num text-mini text-ink-3">
          {text.length} / {MAX_LEN}
        </span>
      </div>
    </div>
  );
}
