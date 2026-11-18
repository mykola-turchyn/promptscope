import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '~/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  to: string;
}

const tabClasses = (selected: boolean, size: 'sm' | 'md') =>
  cn(
    'inline-flex items-center border-0 border-b-2 bg-transparent font-medium no-underline',
    size === 'sm' ? 'h-9 px-2.5' : '-mb-px h-[38px] px-3',
    selected ? 'border-accent text-fg' : 'border-transparent text-muted',
  );

export function Tabs({
  label,
  items,
  selected,
  size = 'sm',
  aside,
  className,
}: {
  label: string;
  items: TabItem[];
  selected: string;
  size?: 'sm' | 'md';
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex flex-wrap items-center gap-1 border-b border-border',
        size === 'sm' && 'px-3 pt-2',
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          role="tab"
          aria-selected={item.id === selected}
          preventScrollReset
          replace
          className={tabClasses(item.id === selected, size)}
        >
          {item.label}
        </Link>
      ))}
      {aside}
    </div>
  );
}
