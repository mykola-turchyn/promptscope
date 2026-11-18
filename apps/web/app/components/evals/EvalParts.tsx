import { Link } from 'react-router';
import { Badge } from '~/components/ui/Badge';
import { Card, SectionTitle } from '~/components/ui/Card';
import { LegendItem } from '~/components/ui/Misc';
import { cn } from '~/lib/cn';
import type { ScorerRow, Verdict } from '~/lib/verdict';

export function RunCard({
  caption,
  title,
  meta,
  candidate,
}: {
  caption: string;
  title: string;
  meta: string;
  candidate?: boolean;
}) {
  return (
    <Card className={cn('flex flex-col gap-1.5 px-[18px] py-4', candidate && 'border-accent')}>
      <span className="flex items-center gap-2 text-xs text-subtle">
        <span className={cn('size-2.5 rounded-[3px]', candidate ? 'bg-accent' : 'bg-subtle')} />
        {caption}
      </span>
      <span className="font-mono text-[15px] font-medium">{title}</span>
      <span className="text-xs text-subtle">{meta}</span>
    </Card>
  );
}

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-1.5 px-[18px] py-4',
        verdict.candidateWins
          ? 'border-success-soft bg-success-soft'
          : 'border-warning-soft bg-warning-soft',
      )}
    >
      <span className="text-xs text-subtle">Verdict</span>
      <span
        className={cn(
          'text-[15px] font-semibold',
          verdict.candidateWins ? 'text-success' : 'text-warning',
        )}
      >
        {verdict.headline}
      </span>
      <span className="text-xs text-muted">{verdict.details}</span>
    </Card>
  );
}

function ScoreBar({
  width,
  value,
  candidate,
}: {
  width: number;
  value: string;
  candidate?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 rounded-[3px] bg-surface-2">
        <div
          className={cn('h-full rounded-[3px]', candidate ? 'bg-accent' : 'bg-subtle')}
          style={{ width: `${width}%` }}
        />
      </div>
      <span
        className={cn(
          'tabular w-12 text-right text-xs',
          candidate ? 'font-semibold' : 'text-muted',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ScorerBars({
  rows,
  labels,
}: {
  rows: ScorerRow[];
  labels: { a: string; b: string };
}) {
  return (
    <Card as="section" aria-label="Scores by scorer" className="flex flex-col gap-[18px] p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>Scores by scorer</SectionTitle>
        <div className="flex gap-3.5 text-xs text-muted">
          <LegendItem label={labels.a} swatchClassName="bg-subtle" />
          <LegendItem label={labels.b} swatchClassName="bg-accent" />
        </div>
      </div>
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_72px] items-center gap-4"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{row.name}</span>
            <span className="text-xs text-subtle">{row.kindLabel}</span>
          </div>
          <div className="flex flex-col gap-1">
            <ScoreBar width={row.aWidth} value={row.a} />
            <ScoreBar width={row.bWidth} value={row.b} candidate />
          </div>
          <Badge tone={row.improved ? 'success' : 'danger'} strong className="justify-self-end">
            {row.delta}
          </Badge>
        </div>
      ))}
    </Card>
  );
}

export function RegressionToggle({ active, href }: { active: boolean; href: string }) {
  return (
    <Link
      to={href}
      preventScrollReset
      replace
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-control border px-3 font-medium no-underline',
        active
          ? 'border-danger-soft bg-danger-soft text-danger'
          : 'border-border bg-surface text-fg',
      )}
    >
      Show regressions only
    </Link>
  );
}
