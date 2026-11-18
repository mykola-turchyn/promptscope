import { projectContext } from '~/.server/context';
import { exportTraces } from '~/.server/queries/traces';
import { toCsv } from '~/lib/csv';
import { parseTraceFilters } from '~/lib/trace-filters';
import type { Route } from './+types/traces-export';

const COLUMNS = [
  'id',
  'name',
  'status',
  'model',
  'user_id',
  'tokens_in',
  'tokens_out',
  'latency_ms',
  'cost_usd',
  'tags',
  'started_at',
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const { project } = context.get(projectContext);
  const filters = parseTraceFilters(new URL(request.url).searchParams);
  const rows = await exportTraces(project.id, filters);
  const csv = toCsv(
    COLUMNS,
    rows.map((row) => [
      row.id,
      row.name,
      row.status,
      row.models.join(' '),
      row.userId ?? '',
      row.totalTokensIn,
      row.totalTokensOut,
      row.latencyMs ?? '',
      row.totalCost,
      row.tags.join(' '),
      row.startedAt.toISOString(),
    ]),
  );

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${project.slug}-traces.csv"`,
    },
  });
}
