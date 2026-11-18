import { type TraceDisplayStatus, traceDisplayStatus } from '@promptscope/shared/status';
import { Badge, type Tone } from '~/components/ui/Badge';

const STATUS: Record<TraceDisplayStatus, { label: string; tone: Tone }> = {
  ok: { label: 'OK', tone: 'success' },
  slow: { label: 'Slow', tone: 'warning' },
  error: { label: 'Error', tone: 'danger' },
};

export function TraceStatusBadge({
  status,
  latencyMs,
  dot = true,
  size,
}: {
  status: string;
  latencyMs: number | null;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  const { label, tone } = STATUS[traceDisplayStatus(status, latencyMs)];

  return (
    <Badge tone={tone} dot={dot} size={size}>
      {label}
    </Badge>
  );
}
