import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '~/lib/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'nav';
}

export function Card({ as: Element = 'div', className, ...props }: CardProps) {
  return (
    <Element className={cn('rounded-card border border-border bg-surface', className)} {...props} />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  titleId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-4',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={titleId} className="m-0 text-base font-semibold">
          {title}
        </h2>
        {description && <span className="text-[13px] text-muted">{description}</span>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('m-0 text-[15px] font-semibold', className)}>{children}</h2>;
}
