import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'amber' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLS: Record<Variant, string> = {
  primary: 'bg-ink-1 text-bg-base hover:opacity-90',
  ghost: 'bg-transparent text-ink-3 border border-[rgba(95,94,90,0.3)]',
  amber: 'bg-amber-light text-amber-deep',
  danger: 'bg-[rgba(226,75,74,0.12)] text-[#E24B4A] border border-[rgba(226,75,74,0.3)]',
};

const SIZE_CLS = {
  sm: 'px-4 py-2 text-small',
  md: 'px-5 py-3 text-body',
  lg: 'px-6 py-4 text-h3',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={clsx(
        'rounded-full font-title font-medium transition active:scale-[0.98]',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
        fullWidth && 'w-full',
        rest.disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {children}
    </button>
  );
}
