import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('routes/home.ts'),
  route('sign-in', 'routes/sign-in.tsx'),
  route('sign-up', 'routes/sign-up.tsx'),
  route('sign-out', 'routes/sign-out.ts'),
  route('demo', 'routes/demo.ts'),
  route('theme', 'routes/theme.ts'),
  route('api/auth/*', 'routes/api-auth.ts'),
  route(':org/:project', 'routes/project/layout.tsx', [
    index('routes/project/overview.tsx'),
    route('events', 'routes/project/events.ts'),
    route('demo-data', 'routes/project/demo-data.ts'),
    route('traces', 'routes/project/traces.tsx'),
    route('traces/export', 'routes/project/traces-export.ts'),
    route('traces/:traceId', 'routes/project/trace.tsx'),
    route('prompts', 'routes/project/prompts-index.ts'),
    route('prompts/new', 'routes/project/prompt-new.tsx'),
    route('prompts/:name', 'routes/project/prompt.tsx'),
    route('datasets', 'routes/project/datasets-index.ts'),
    route('datasets/new', 'routes/project/dataset-new.tsx'),
    route('datasets/:datasetId', 'routes/project/dataset.tsx'),
    route('evals', 'routes/project/evals-index.tsx'),
    route('evals/compare', 'routes/project/eval-compare.tsx'),
    route('settings', 'routes/project/settings-index.ts'),
    route('settings/:tab', 'routes/project/settings.tsx'),
  ]),
] satisfies RouteConfig;
