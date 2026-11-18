# ADR 0001: Monorepo and stack

- Status: accepted
- Date: 2026-11-18

## Context

Promptscope has three runtimes (dashboard, ingest API, worker) and a published SDK. They share one
event schema and one database schema. A change to an event field must reach the SDK, the ingest
validation, the worker and the dashboard in one commit, or the system drifts.

## Decision

One pnpm workspace with Turborepo:

| Part             | Choice                                        | Why                                                                                                         |
| ---------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Shared contracts | `packages/shared`, Zod 4                      | One schema validates events in ingest and types them in the SDK and worker                                  |
| Database         | `packages/db`, Postgres 18 + Drizzle ORM 0.45 | Typed queries inferred from the schema, `jsonb` for payloads, native `uuidv7()`, range partitions for spans |
| Dashboard        | React Router 8 (framework mode), Tailwind 4   | Loaders, actions and middleware; forms work without JavaScript; SSR                                         |
| Ingest           | Fastify 5                                     | Low per-request overhead, built-in body limits, `inject()` for tests                                        |
| Queue            | BullMQ 6 on Redis 8                           | Retries, backoff, dead-letter handling and concurrency limits out of the box                                |
| Auth             | Better Auth 1.7 with the organization plugin  | Email and GitHub sign-in, organizations and roles without a SaaS dependency                                 |
| Tests            | Vitest 5, MSW 3, Playwright 1.65              | Unit tests, SDK network tests without a server, one end-to-end flow                                         |
| Lint and format  | Biome 2.6                                     | One fast tool instead of ESLint plus Prettier                                                               |

Workspace packages (`shared`, `db`) are consumed as TypeScript source. Apps bundle them at build time
(`tsup` for ingest and worker, Vite for the dashboard), so there is no separate publish step inside
the repo. The SDK bundles the parts of `shared` it needs and has no runtime dependencies.

## Versions we deliberately did not take

- **TypeScript 6.0, not 7.0.** 7.0 has no stable compiler API yet and tsup's declaration build and
  drizzle-kit depend on it. Revisit after 7.1.
- **Fastify 5.12, not 6.0.** 6.0 is still in alpha.
- **Drizzle 0.45, not 1.0.** 1.0 is a release candidate that still changes its API.

## Consequences

- `pnpm typecheck`, `pnpm test` and `pnpm build` run across everything through Turborepo caching.
- The dashboard does not use shadcn/ui's generated components: the design has its own tokens and
  component specs, so the UI kit lives in `apps/web/app/components/ui` built with `cva` and
  `tailwind-merge` (the same building blocks shadcn uses).
- Charts are plain CSS and SVG instead of Recharts. The design draws stacked bars and two lines;
  that is about 100 lines of code and keeps the client bundle small.
