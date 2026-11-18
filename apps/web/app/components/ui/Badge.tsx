import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

export type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent-text',
  neutral: 'bg-neutral-soft text-neutral',
};

const DOT_CLASSES: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
  neutral: 'bg-neutral',
};

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap px-2 text-xs font-medium',
  {
    variants: {
      shape: { pill: 'rounded-full', chip: 'rounded-chip' },
      size: { xs: 'h-5 text-[11px]', sm: 'h-[22px]', md: 'h-6' },
      strong: { true: 'font-semibold tabular' },
    },
    defaultVariants: { shape: 'pill', size: 'sm' },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  tone: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone, dot = false, shape, size, strong, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ shape, size, strong }), TONE_CLASSES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-chip bg-surface-2 px-2 text-xs text-muted">
      {children}
    </span>
  );
}
