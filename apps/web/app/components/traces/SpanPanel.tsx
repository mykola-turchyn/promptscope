import { useSearchParams } from 'react-router';
import { Card } from '~/components/ui/Card';
import { CodeBlock } from '~/components/ui/Misc';
import { Tabs } from '~/components/ui/Tabs';
import { formatCost, formatCount, formatDuration } from '~/lib/format';
import { asText, spanMessages } from '~/lib/messages';
import { SpanKindBadge } from './SpanKind';

export interface PanelSpan {
  id: string;
  name: string;
  type: string;
  status: string;
  model: string | null;
  input: unknown;
  output: unknown;
  metadata: Record<string, unknown>;
  tokensIn: number | null;
  tokensOut: number | null;
  cost: number | null;
  latencyMs: number;
  error: string | null;
}

export interface PanelScore {
  name: string;
  value: number;
  source: string;
  spanId: string | null;
  comment: string | null;
}

export const SPAN_TABS = ['io', 'metadata', 'scores'] as const;
export type SpanTab = (typeof SPAN_TABS)[number];

function tokensText(span: PanelSpan): string {
  if (span.tokensIn === null && span.tokensOut === null) return '—';
  if (!span.tokensOut) return `${formatCount(span.tokensIn ?? 0)} tokens`;

  return `${formatCount(span.tokensIn ?? 0)} / ${formatCount(span.tokensOut)} tokens`;
}

function Labeled({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.04em] text-subtle uppercase">
        {label}
      </span>
      <CodeBlock>{text}</CodeBlock>
    </div>
  );
}

function ScoresList({ scores }: { scores: PanelScore[] }) {
  if (scores.length === 0) return <p className="m-0 text-muted">No scores for this span yet.</p>;

  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
      {scores.map((score) => (
        <div key={`${score.name}-${score.source}`} className="contents">
          <dt className="text-subtle">
            {score.name} · {score.source}
          </dt>
          <dd className="tabular m-0 font-semibold">
            {score.value}
            {score.comment && <span className="ml-2 font-normal text-muted">{score.comment}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SpanPanel({
  span,
  tab,
  scores,
}: {
  span: PanelSpan;
  tab: SpanTab;
  scores: PanelScore[];
}) {
  const [searchParams] = useSearchParams();
  const tabHref = (id: SpanTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);

    return `?${next}`;
  };
  const failed = span.status === 'error';

  return (
    <Card as="section" aria-label="Selected span" className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-2.5 border-b border-border px-[18px] py-4">
        <div className="flex items-center gap-2">
          <SpanKindBadge type={span.type} failed={failed} size="md" />
          <h2 className="m-0 text-base font-semibold">{span.name}</h2>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          <span>{formatDuration(span.latencyMs)}</span>
          <span className="font-mono">{span.model ?? '—'}</span>
          <span>{tokensText(span)}</span>
          <span>{formatCost(span.cost)}</span>
        </div>
      </div>
      <Tabs
        label="Span data"
        selected={tab}
        items={[
          { id: 'io', label: 'Input / output', to: tabHref('io') },
          { id: 'metadata', label: 'Metadata', to: tabHref('metadata') },
          { id: 'scores', label: 'Scores', to: tabHref('scores') },
        ]}
      />
      <div className="flex flex-col gap-3 px-[18px] py-4">
        {tab === 'io' &&
          spanMessages(span).map((block) => (
            <Labeled key={block.id} label={block.role} text={block.text} />
          ))}
        {tab === 'metadata' && <CodeBlock>{asText(span.metadata)}</CodeBlock>}
        {tab === 'scores' && <ScoresList scores={scores} />}
      </div>
    </Card>
  );
}
