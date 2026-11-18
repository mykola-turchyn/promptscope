import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';
import { Icon } from './Icon';

export function PageHeading({
  title,
  description,
  actions,
  mono,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="flex flex-col gap-1">
        <h1 className={cn('m-0 text-2xl font-semibold tracking-[-0.02em]', mono && 'font-mono')}>
          {title}
        </h1>
        {description && <p className="m-0 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LegendItem({
  label,
  swatchClassName,
  line,
}: {
  label: string;
  swatchClassName: string;
  line?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn(line ? 'h-0.5 w-3' : 'size-2 rounded-[2px]', swatchClassName)} />
      {label}
    </span>
  );
}

export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        'm-0 whitespace-pre-wrap break-words rounded-control border border-border bg-code-bg p-3 font-mono text-xs leading-[1.55] text-fg',
        className,
      )}
    >
      {children}
    </pre>
  );
}

export function Alert({
  tone,
  title,
  children,
  live,
}: {
  tone: 'danger' | 'warning';
  title: ReactNode;
  children?: ReactNode;
  live?: boolean;
}) {
  return (
    <div
      role={live ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-fg',
        tone === 'danger' ? 'border-danger-soft bg-danger-soft' : 'border-warning bg-warning-soft',
      )}
    >
      <Icon
        name={tone === 'danger' ? 'alertCircle' : 'alertTriangle'}
        size={18}
        className={cn('mt-px flex-none', tone === 'danger' ? 'text-danger' : 'text-warning')}
      />
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        {children && <span className="text-muted">{children}</span>}
      </div>
    </div>
  );
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
