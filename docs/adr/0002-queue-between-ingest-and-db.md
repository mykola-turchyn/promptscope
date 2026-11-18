# ADR 0002: A queue between ingest and the database

- Status: accepted
- Date: 2026-11-18

## Context

The SDK runs inside customers' applications. Telemetry must never slow those applications down or
lose data when the database is busy, migrating or briefly unavailable. Writes are bursty: a batch
job can emit thousands of spans in a second, then nothing for minutes.

## Decision

`POST /v1/ingest` only authenticates the key, validates the batch with the shared Zod schema,
applies a per-project token bucket in Redis and enqueues the batch in BullMQ. It answers
`202 Accepted` without touching Postgres. The worker consumes the queue and:

1. creates the monthly span partition if it is missing,
2. upserts traces and spans (ids come from the SDK, so retries never duplicate rows),
3. prices spans with `model_prices` on the server,
4. recomputes trace aggregates (cost, tokens, span count, models by cost, status, latency),
5. publishes a message on the project's Redis channel so open dashboards refresh over SSE.

Failed jobs retry five times with exponential backoff. A job that still fails moves to the
`ingest-dead-letter` queue with its error, so a malformed batch never blocks the rest.

## Consequences

- Ingest latency is independent of the database. Measured locally (32 connections, 50 spans per
  request): about 5,900 requests per second, p50 4.8 ms, p99 9.9 ms.
- Data appears with a short delay (the worker drained about 21,000 spans per second locally).
- **If Redis goes down**, ingest answers 5xx, the SDK keeps events in memory and retries with
  backoff, and the dashboard keeps working without live updates. Redis is the single dependency
  of the hot path, so production runs it with persistence (AOF) or as a managed service.
- Rate limiting is per project and counts events, not requests, so one noisy project cannot starve
  the others.
