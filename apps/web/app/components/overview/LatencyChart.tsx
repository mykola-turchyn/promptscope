import { LegendItem } from '~/components/ui/Misc';
import { linePoints, niceCeiling } from '~/lib/charts';
import { type AxisTick, axisLabels, ChartCard, ChartPlot, PLOT_HEIGHT } from './ChartFrame';

const VIEWBOX_WIDTH = 700;
const MS_PER_SECOND = 1_000;

function axisSeconds(ms: number): string {
  const seconds = ms / MS_PER_SECOND;

  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

function rangeText(values: Array<number | null>): string {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return 'no data';
  const low = Math.min(...present) / MS_PER_SECOND;
  const high = Math.max(...present) / MS_PER_SECOND;

  return `between ${low.toFixed(1)} and ${high.toFixed(1)} seconds`;
}

export function LatencyChart({
  title,
  points,
  axis,
}: {
  title: string;
  points: Array<{ p95: number | null; p50: number | null }>;
  axis: AxisTick[];
}) {
  const p95 = points.map((point) => point.p95);
  const p50 = points.map((point) => point.p50);
  const max = niceCeiling(
    Math.max(MS_PER_SECOND, ...p95.filter((value): value is number => value !== null)),
  );

  return (
    <ChartCard
      title={title}
      legend={
        <>
          <LegendItem label="p95" swatchClassName="bg-c1" line />
          <LegendItem label="p50" swatchClassName="bg-c2" line />
        </>
      }
    >
      <ChartPlot yLabels={axisLabels(max, axisSeconds)} xAxis={axis}>
        <svg
          role="img"
          aria-label={`p95 latency ${rangeText(p95)}, p50 ${rangeText(p50)}`}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${PLOT_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <polyline
            points={linePoints(p95, max, VIEWBOX_WIDTH, PLOT_HEIGHT)}
            fill="none"
            stroke="var(--c1)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          <polyline
            points={linePoints(p50, max, VIEWBOX_WIDTH, PLOT_HEIGHT)}
            fill="none"
            stroke="var(--c2)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </ChartPlot>
    </ChartCard>
  );
}
