import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';
import { Card } from './Card';

export function MetricTile({
  label,
  value,
  caption,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-[18px]">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cn('tabular text-[28px] font-semibold tracking-[-0.02em]', valueClassName)}>
        {value}
      </span>
      <span className="text-xs text-subtle">{caption}</span>
    </Card>
  );
}

export function Stat({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-subtle">{label}</span>
      <span className={cn(mono ? 'font-mono text-[13px]' : 'tabular font-semibold')}>
        {children}
      </span>
    </div>
  );
}
