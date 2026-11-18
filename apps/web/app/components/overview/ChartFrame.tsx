import type { ReactNode } from 'react';
import { Card, SectionTitle } from '~/components/ui/Card';

const PLOT_HEIGHT = 180;
const MAX_X_LABELS = 8;

export function axisLabels(
  max: number,
  format: (value: number) => string,
): [string, string, string] {
  return [format(max), format(max / 2), format(0)];
}

export interface AxisTick {
  key: string;
  label: string;
}

export function sparseTicks(ticks: AxisTick[]): AxisTick[] {
  const every = Math.ceil(ticks.length / MAX_X_LABELS);

  return ticks.map((tick, index) => (index % every === 0 ? tick : { ...tick, label: '' }));
}

export function ChartCard({
  title,
  legend,
  children,
}: {
  title: string;
  legend: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>{title}</SectionTitle>
        <div className="flex flex-wrap gap-3.5 text-xs text-muted">{legend}</div>
      </div>
      {children}
    </Card>
  );
}

export function ChartPlot({
  yLabels,
  xAxis,
  children,
  gap,
}: {
  yLabels: [string, string, string];
  xAxis: AxisTick[];
  children: ReactNode;
  gap?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <div
        className="tabular flex min-w-7 flex-col justify-between text-right text-[11px] text-subtle"
        style={{ height: PLOT_HEIGHT }}
      >
        <span>{yLabels[0]}</span>
        <span>{yLabels[1]}</span>
        <span>{yLabels[2]}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative border-b border-border" style={{ height: PLOT_HEIGHT }}>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
          {children}
        </div>
        <div
          className={
            gap ? 'flex gap-3.5 px-1.5 text-[11px] text-subtle' : 'flex text-[11px] text-subtle'
          }
        >
          {sparseTicks(xAxis).map((tick) => (
            <span key={tick.key} className="flex-1 text-center whitespace-nowrap">
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export { PLOT_HEIGHT };
