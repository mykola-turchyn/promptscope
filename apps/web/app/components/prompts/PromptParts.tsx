import type { ModelConfig } from '@promptscope/db/schema';
import { Link } from 'react-router';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { Icon } from '~/components/ui/Icon';
import { Stat } from '~/components/ui/Stat';
import { cn } from '~/lib/cn';
import type { DiffLine } from '~/lib/diff';
import { formatCount } from '~/lib/format';

export function PromptNav({
  prompts,
  current,
  canEdit,
}: {
  prompts: Array<{ name: string; meta: string }>;
  current: string | null;
  canEdit: boolean;
}) {
  return (
    <nav aria-label="Prompts" className="flex max-w-full flex-[1_1_200px] flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-[13px] font-semibold">Prompts</h2>
        {canEdit && (
          <Link
            to="../new"
            relative="path"
            aria-label="New prompt"
            className="flex size-8 items-center justify-center rounded-control border border-border bg-surface text-muted"
          >
            <Icon name="plus" size={14} strokeWidth={2.2} />
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {prompts.map((prompt) => (
          <Link
            key={prompt.name}
            to={`../${prompt.name}`}
            relative="path"
            aria-current={prompt.name === current ? 'page' : undefined}
            className={cn(
              'flex flex-col gap-0.5 rounded-control px-2.5 py-2 text-fg no-underline',
              prompt.name === current && 'bg-accent-soft',
            )}
          >
            <span className="font-mono text-[13px] font-medium">{prompt.name}</span>
            <span className="text-xs text-subtle">{prompt.meta}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

const LINE_STYLES = {
  same: { mark: '', row: '', markColor: '' },
  add: { mark: '+', row: 'bg-success-soft', markColor: 'text-success' },
  del: { mark: '−', row: 'bg-danger-soft', markColor: 'text-danger' },
};

export function TemplateLines({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-x-auto py-2">
      {lines.map((line) => {
        const style = LINE_STYLES[line.kind];

        return (
          <div
            key={line.id}
            className={cn(
              'grid grid-cols-[44px_20px_minmax(0,1fr)] items-baseline font-mono text-[13px] leading-[1.7]',
              style.row,
            )}
          >
            <span className="pr-2 text-right text-subtle select-none">{line.number ?? ''}</span>
            <span className={cn('text-center select-none', style.markColor)}>{style.mark}</span>
            <span className="pr-4 whitespace-pre-wrap text-fg">{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Variables({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
      <span className="text-xs text-subtle">Variables</span>
      {names.length === 0 && <span className="text-xs text-muted">None</span>}
      {names.map((name) => (
        <span
          key={name}
          className="inline-flex h-6 items-center rounded-chip bg-accent-soft px-2 font-mono text-xs text-accent-text"
        >
          {name}
        </span>
      ))}
    </div>
  );
}

export interface VersionItem {
  id: string;
  version: number;
  note: string | null;
  labels: string[];
  meta: string;
}

const LABEL_TONES = { production: 'success', staging: 'warning' } as const;

export function VersionsList({
  versions,
  selected,
  hrefFor,
}: {
  versions: VersionItem[];
  selected: number;
  hrefFor: (version: number) => string;
}) {
  return (
    <Card as="section" aria-label="Versions" className="flex flex-col">
      <h2 className="m-0 px-4 pt-3.5 pb-2 text-[13px] font-semibold">Versions</h2>
      <ol className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2">
        {versions.map((version) => (
          <li key={version.id}>
            <Link
              to={hrefFor(version.version)}
              preventScrollReset
              aria-current={version.version === selected ? 'true' : undefined}
              className={cn(
                'flex items-start gap-2.5 rounded-control p-2 text-fg no-underline',
                version.version === selected && 'bg-surface-2',
              )}
            >
              <span className="min-w-6 font-mono text-[13px] font-semibold">
                v{version.version}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px]">{version.note ?? 'No description'}</span>
                <span className="text-xs text-subtle">{version.meta}</span>
              </span>
              {version.labels.map((label) => (
                <Badge
                  key={label}
                  tone={LABEL_TONES[label as keyof typeof LABEL_TONES] ?? 'neutral'}
                  size="xs"
                >
                  {label}
                </Badge>
              ))}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function ModelSettings({ version, config }: { version: number; config: ModelConfig }) {
  const rows = [
    { label: 'Model', value: config.model ?? '—', mono: true },
    {
      label: 'Temperature',
      value: config.temperature === undefined ? '—' : String(config.temperature),
    },
    {
      label: 'Max tokens',
      value: config.maxTokens === undefined ? '—' : formatCount(config.maxTokens),
    },
    { label: 'Tools', value: config.tools?.join(', ') || '—', mono: true },
  ];

  return (
    <Card as="section" aria-label="Model settings" className="flex flex-col gap-3 px-4 py-3.5">
      <h2 className="m-0 text-[13px] font-semibold">Model settings · v{version}</h2>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-subtle">{row.label}</dt>
            <dd className={cn('m-0', row.mono ? 'font-mono text-xs' : 'tabular')}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function VersionMetrics({
  title,
  metrics,
}: {
  title: string;
  metrics: { avgScore: string; avgCost: string; p95: string };
}) {
  return (
    <Card as="section" aria-label="Version metrics" className="flex flex-col gap-3 px-4 py-3.5">
      <h2 className="m-0 text-[13px] font-semibold">{title}</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Avg score">{metrics.avgScore}</Stat>
        <Stat label="Avg cost">{metrics.avgCost}</Stat>
        <Stat label="p95">{metrics.p95}</Stat>
      </div>
    </Card>
  );
}

export function PromoteButton({ version }: { version: number }) {
  return (
    <Button type="submit" name="intent" value="promote" variant="primary">
      Promote v{version} to production
    </Button>
  );
}
