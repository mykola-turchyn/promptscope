import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Card } from '~/components/ui/Card';
import { cn } from '~/lib/cn';
import { formatDuration } from '~/lib/format';
import { timelineTicks } from '~/lib/span-tree';
import { SpanKindBadge, spanKindStyle } from './SpanKind';

export interface WaterfallSpan {
  id: string;
  name: string;
  type: string;
  status: string;
  depth: number;
  startedAt: Date;
  latencyMs: number;
}

const ROW_HEIGHT = 40;
const VIRTUALIZE_FROM = 100;
const VIRTUAL_VIEWPORT = 640;
const INDENT_PX = 16;
const PERCENT = 100;
const MS_PER_SECOND = 1_000;
const GRID = 'grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-3';

function SpanRow({
  span,
  selected,
  traceStart,
  totalMs,
  href,
}: {
  span: WaterfallSpan;
  selected: boolean;
  traceStart: number;
  totalMs: number;
  href: string;
}) {
  const failed = span.status === 'error';
  const left = ((span.startedAt.getTime() - traceStart) / totalMs) * PERCENT;
  const width = (span.latencyMs / totalMs) * PERCENT;

  return (
    <Link
      to={href}
      replace
      preventScrollReset
      aria-current={selected ? 'true' : undefined}
      className={cn(
        GRID,
        'min-h-10 items-center rounded-control px-2.5 text-fg no-underline',
        selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
      )}
    >
      <span
        className="flex min-w-0 items-center gap-2"
        style={{ paddingLeft: span.depth * INDENT_PX }}
      >
        <SpanKindBadge type={span.type} failed={failed} />
        <span className={cn('truncate text-[13px]', failed && 'text-danger')}>{span.name}</span>
      </span>
      <span className="relative h-[18px]">
        <span
          className={cn(
            'absolute top-1 h-2.5 min-w-[3px] rounded-[3px]',
            spanKindStyle(span.type, failed).bar,
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <span className="tabular absolute top-0 right-0 text-[11px] text-subtle">
          {formatDuration(span.latencyMs)}
        </span>
      </span>
    </Link>
  );
}

export function SpanWaterfall({
  spans,
  selectedId,
  traceStart,
  totalMs,
}: {
  spans: WaterfallSpan[];
  selectedId: string | null;
  traceStart: number;
  totalMs: number;
}) {
  const [searchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = spans.length >= VIRTUALIZE_FROM;
  const virtualizer = useVirtualizer({
    count: spans.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtualize,
  });
  const safeTotal = Math.max(1, totalMs);
  const hrefFor = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('span', id);

    return `?${next}`;
  };
  const renderRow = (span: WaterfallSpan) => (
    <SpanRow
      key={span.id}
      span={span}
      selected={span.id === selectedId}
      traceStart={traceStart}
      totalMs={safeTotal}
      href={hrefFor(span.id)}
    />
  );

  return (
    <Card as="section" aria-label="Spans" className="flex min-w-0 flex-col">
      <div className={cn(GRID, 'border-b border-border px-4 py-3 text-xs text-subtle')}>
        <span>Span</span>
        <div className="tabular relative h-4">
          {timelineTicks(safeTotal).map((tick) => (
            <span
              key={tick}
              className="absolute"
              style={{ left: `${(tick / safeTotal) * PERCENT}%` }}
            >
              {tick / MS_PER_SECOND} s
            </span>
          ))}
        </div>
      </div>
      {virtualize ? (
        <div
          ref={scrollRef}
          className="overflow-auto p-1.5"
          style={{ maxHeight: VIRTUAL_VIEWPORT }}
        >
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const span = spans[item.index];

              return span ? (
                <div
                  key={span.id}
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {renderRow(span)}
                </div>
              ) : null;
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col p-1.5">{spans.map(renderRow)}</div>
      )}
    </Card>
  );
}
