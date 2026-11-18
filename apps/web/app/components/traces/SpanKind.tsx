import { cn } from '~/lib/cn';

const KINDS: Record<string, { label: string; text: string; bar: string }> = {
  llm: { label: 'LLM', text: 'text-c1', bar: 'bg-c1' },
  tool: { label: 'TOOL', text: 'text-c2', bar: 'bg-c2' },
  retrieval: { label: 'RET', text: 'text-c3', bar: 'bg-c3' },
  agent: { label: 'AGENT', text: 'text-subtle', bar: 'bg-subtle' },
  http: { label: 'HTTP', text: 'text-subtle', bar: 'bg-subtle' },
  custom: { label: 'SPAN', text: 'text-subtle', bar: 'bg-subtle' },
};
const ERROR_STYLE = { text: 'text-danger', bar: 'bg-danger' };

export function spanKindStyle(type: string, failed: boolean) {
  const kind = KINDS[type] ??
    KINDS.custom ?? { label: 'SPAN', text: 'text-subtle', bar: 'bg-subtle' };

  return failed ? { ...kind, ...ERROR_STYLE } : kind;
}

export function SpanKindBadge({
  type,
  failed,
  size = 'sm',
}: {
  type: string;
  failed: boolean;
  size?: 'sm' | 'md';
}) {
  const style = spanKindStyle(type, failed);

  return (
    <span
      className={cn(
        'inline-flex flex-none items-center justify-center rounded bg-surface-2 font-semibold tracking-[0.02em]',
        size === 'sm'
          ? 'h-[18px] min-w-[34px] px-1 text-[10px]'
          : 'h-5 min-w-[34px] px-1.5 text-[11px]',
        style.text,
      )}
    >
      {style.label}
    </span>
  );
}
