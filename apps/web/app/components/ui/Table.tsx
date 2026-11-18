import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '~/lib/cn';

export function Table({
  minWidth,
  caption,
  children,
}: {
  minWidth: number;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, bordered }: { children: ReactNode; bordered?: boolean }) {
  return (
    <thead>
      <tr className={cn('text-left text-subtle', bordered && '[&>th]:border-t')}>{children}</tr>
    </thead>
  );
}

interface CellProps {
  align?: 'left' | 'right';
}

export function Th({
  align,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-border px-3 py-2.5 font-medium first:pl-[18px] last:pr-[18px]',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  align,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & CellProps) {
  return (
    <td
      className={cn(
        'border-b border-border px-3 py-[11px] first:pl-[18px] last:pr-[18px]',
        align === 'right' && 'tabular text-right',
        className,
      )}
      {...props}
    />
  );
}
