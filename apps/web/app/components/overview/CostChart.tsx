import { LegendItem } from '~/components/ui/Misc';
import { type CostSeries, niceCeiling } from '~/lib/charts';
import { cn } from '~/lib/cn';
import { formatCost } from '~/lib/format';
import { type AxisTick, axisLabels, ChartCard, ChartPlot } from './ChartFrame';

export const SERIES_CLASSES = ['bg-c1', 'bg-c2', 'bg-c3'] as const;

function axisCost(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1) return `$${Number.isInteger(value) ? value : value.toFixed(1)}`;

  return `$${Number(value.toPrecision(2))}`;
}

export function CostChart({
  title,
  data,
  axis,
}: {
  title: string;
  data: CostSeries;
  axis: AxisTick[];
}) {
  const max = niceCeiling(data.max);

  return (
    <ChartCard
      title={title}
      legend={data.series.map((name, index) => (
        <LegendItem key={name} label={name} swatchClassName={SERIES_CLASSES[index] ?? 'bg-c3'} />
      ))}
    >
      <ChartPlot yLabels={axisLabels(max, axisCost)} xAxis={axis} gap>
        <div className="absolute inset-0 flex items-end gap-3.5 px-1.5">
          {data.buckets.map(({ bucket, values, total }, bucketIndex) => (
            <div
              key={bucket.getTime()}
              title={`${axis[bucketIndex]?.label ?? ''}: ${formatCost(total)}`}
              className="flex h-full flex-1 flex-col-reverse gap-0.5"
            >
              {values.map((value, index) =>
                value > 0 ? (
                  <div
                    key={data.series[index]}
                    className={cn(
                      SERIES_CLASSES[index] ?? 'bg-c3',
                      'first:rounded-b-[3px] last:rounded-t-[3px]',
                    )}
                    style={{ height: `${(value / max) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
          ))}
        </div>
      </ChartPlot>
    </ChartCard>
  );
}
