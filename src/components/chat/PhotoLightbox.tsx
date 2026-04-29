'use client';

import { useEffect } from 'react';

export function PhotoLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-[60] bg-black/85 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="关闭"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white border-0 cursor-pointer flex items-center justify-center text-xl"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="预览"
        className="max-w-[92%] max-h-[88%] object-contain rounded-card"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
