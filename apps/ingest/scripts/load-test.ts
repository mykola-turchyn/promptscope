// Sends batches of spans to the ingest API from parallel connections and reports throughput.
// Usage: INGEST_URL=http://localhost:4318 API_KEY=ps_live_… pnpm --filter @promptscope/ingest load-test
import { newId } from '@promptscope/shared/ids';

const url = `${process.env.INGEST_URL ?? 'http://localhost:4318'}/v1/ingest`;
const apiKey = process.env.API_KEY ?? '';
const durationMs = Number(process.env.DURATION_MS ?? 15_000);
const connections = Number(process.env.CONNECTIONS ?? 32);
const batchSize = Number(process.env.BATCH_SIZE ?? 50);
const HTTP_ACCEPTED = 202;
const SPAN_MS = 800;
const P50 = 0.5;
const P99 = 0.99;
const MS_PER_SECOND = 1_000;

if (!apiKey) throw new Error('Set API_KEY to a project API key');

function batch() {
  const traceId = newId('trace');
  const start = Date.now();

  return JSON.stringify({
    events: Array.from({ length: batchSize }, (_, index) => ({
      type: 'span',
      id: newId('span'),
      traceId,
      name: `load.span-${index}`,
      spanType: 'llm',
      model: 'gpt-4.1-mini',
      usage: { input: 800, output: 40 },
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(start + SPAN_MS).toISOString(),
    })),
  });
}

const latencies: number[] = [];
let accepted = 0;
let rejected = 0;
const deadline = Date.now() + durationMs;

async function connection() {
  while (Date.now() < deadline) {
    const started = performance.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: batch(),
    });
    await response.arrayBuffer();
    latencies.push(performance.now() - started);
    if (response.status === HTTP_ACCEPTED) accepted += 1;
    else rejected += 1;
  }
}

await Promise.all(Array.from({ length: connections }, connection));
latencies.sort((left, right) => left - right);
const seconds = durationMs / MS_PER_SECOND;
const percentile = (fraction: number) =>
  latencies[Math.floor(latencies.length * fraction)]?.toFixed(1);
console.log(
  JSON.stringify(
    {
      connections,
      batchSize,
      requestsPerSecond: Math.round((accepted + rejected) / seconds),
      spansPerSecond: Math.round((accepted * batchSize) / seconds),
      rejected,
      latencyMs: { p50: percentile(P50), p99: percentile(P99) },
    },
    null,
    2,
  ),
);
