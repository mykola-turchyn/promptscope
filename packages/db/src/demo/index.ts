import { randomUUID } from 'node:crypto';
import { extractVariables, providerForModel, type ScorerConfig } from '@promptscope/shared';
import { and, eq } from 'drizzle-orm';
import type { Db, DbOrTransaction } from '../client.ts';
import { ensureSpanPartitions, monthsBetween } from '../partitions.ts';
import {
  datasetItems,
  datasets,
  evalResults,
  evalRuns,
  organization,
  type PromptLabel,
  projects,
  prompts,
  promptVersions,
  spans,
  traces,
} from '../schema/index.ts';
import {
  DATASETS,
  DEMO_ORG,
  DEMO_PROJECT,
  EVAL_ITEMS,
  REFUND_TEMPLATES,
  REFUND_VERSION_NOTES,
  SUPPORT_REPLY_NOTES,
  SUPPORT_SYSTEM_PROMPT,
} from './catalog.ts';
import { seedModelPrices } from './prices.ts';
import { createRandom, type Random } from './random.ts';
import { buildDemoTrace, type DemoTrace } from './traces.ts';

export { DEMO_ORG, DEMO_PROJECT } from './catalog.ts';
export { DEFAULT_MODEL_PRICES, seedModelPrices } from './prices.ts';

const MS_PER_DAY = 86_400_000;
const DEMO_DAYS = 14;
const DEFAULT_TRACES_PER_DAY = 1_200;
const INSERT_CHUNK_SIZE = 400;
const DEFAULT_SEED = 20_261_117;
const DAY_VOLUME_FACTORS = [0.85, 0.95, 0.8, 1.05, 1.15, 0.7, 0.9];
const PREVIOUS_WEEK_VOLUME = 0.92;
const EVAL_ITEM_COST = 0.0525;
const EVAL_DURATION_MS = { v7: 252_000, v8: 271_000 };
const EVAL_GAP_MS = 6 * 60_000;

export interface DemoSeedOptions {
  projectId: string;
  now?: Date;
  tracesPerDay?: number;
  seed?: number;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

export async function ensureDemoProject(db: Db): Promise<{ projectId: string; created: boolean }> {
  const [existingOrg] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, DEMO_ORG.slug));
  const orgId = existingOrg?.id ?? randomUUID();
  if (!existingOrg) {
    await db.insert(organization).values({ id: orgId, ...DEMO_ORG });
  }
  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.slug, DEMO_PROJECT.slug)));
  if (existingProject) return { projectId: existingProject.id, created: false };

  const [project] = await db
    .insert(projects)
    .values({ orgId, ...DEMO_PROJECT })
    .returning({ id: projects.id });
  if (!project) throw new Error('Could not create the demo project');

  return { projectId: project.id, created: true };
}

async function insertPromptVersions(
  db: DbOrTransaction,
  projectId: string,
  name: string,
  versions: Array<{ template: string; note: string; labels?: PromptLabel[] }>,
  model: string,
  now: Date,
  tools?: string[],
) {
  const [prompt] = await db
    .insert(prompts)
    .values({ projectId, name })
    .returning({ id: prompts.id });
  if (!prompt) throw new Error(`Could not create prompt ${name}`);
  const rows = await db
    .insert(promptVersions)
    .values(
      versions.map((version, index) => ({
        promptId: prompt.id,
        version: index + 1,
        template: version.template,
        variables: extractVariables(version.template),
        note: version.note,
        labels: version.labels ?? [],
        modelConfig: {
          provider: providerForModel(model),
          model,
          temperature: 0.2,
          maxTokens: 1024,
          tools,
        },
        createdAt: daysAgo(now, (versions.length - index) * 3),
      })),
    )
    .returning({ id: promptVersions.id, version: promptVersions.version });

  return new Map(rows.map((row) => [row.version, row.id]));
}

async function seedPrompts(db: DbOrTransaction, projectId: string, now: Date) {
  const lastSupportVersion = SUPPORT_REPLY_NOTES.length - 1;
  const support = await insertPromptVersions(
    db,
    projectId,
    'support-reply',
    SUPPORT_REPLY_NOTES.map((note, index) => ({
      template: `${SUPPORT_SYSTEM_PROMPT}\n\nCustomer: {{customer_name}}\nMessage: {{message}}`,
      note,
      labels: index === lastSupportVersion ? ['production'] : [],
    })),
    'claude-sonnet-4-5',
    now,
  );
  const refundLabels: Record<keyof typeof REFUND_TEMPLATES, PromptLabel[]> = {
    v5: [],
    v6: [],
    v7: ['production'],
    v8: ['staging'],
  };
  const refundDrafts = [1, 2, 3, 4].map((version) => ({
    template: REFUND_TEMPLATES.v5.join('\n'),
    note: `Draft ${version}`,
  }));
  const refund = await insertPromptVersions(
    db,
    projectId,
    'refund-agent',
    [
      ...refundDrafts,
      ...(['v5', 'v6', 'v7', 'v8'] as const).map((key) => ({
        template: REFUND_TEMPLATES[key].join('\n'),
        note: REFUND_VERSION_NOTES[key],
        labels: refundLabels[key],
      })),
    ],
    'claude-sonnet-4-5',
    now,
    ['get_order', 'issue_refund'],
  );
  const singleVersion = (count: number, template: string) =>
    Array.from({ length: count }, (_, index) => ({
      template,
      note: index === 0 ? 'Initial version' : `Iteration ${index + 1}`,
      labels: index === count - 1 ? (['production'] satisfies PromptLabel[]) : [],
    }));
  await insertPromptVersions(
    db,
    projectId,
    'ticket-summarize',
    singleVersion(4, 'Summarise the ticket thread in three bullet points:\n\n{{thread}}'),
    'gpt-4.1',
    now,
  );
  await insertPromptVersions(
    db,
    projectId,
    'ticket-classify',
    singleVersion(9, 'Classify the ticket into one of: {{labels}}.\n\nTicket: {{ticket_text}}'),
    'gpt-4.1-mini',
    now,
  );
  const supportProduction = support.get(SUPPORT_REPLY_NOTES.length);
  const refundV7 = refund.get(7);
  const refundV8 = refund.get(8);
  if (!supportProduction || !refundV7 || !refundV8) throw new Error('Demo prompts are incomplete');

  return { supportReply: supportProduction, refundAgent: refundV7, refundV8 };
}

const SOURCE_BY_CATALOG = { trace: 'trace', manual: 'manual', import: 'import' } as const;

async function seedDatasets(db: DbOrTransaction, projectId: string, now: Date, random: Random) {
  const itemIdsByDataset = new Map<string, { datasetId: string; itemIds: string[] }>();
  for (const definition of DATASETS) {
    const [dataset] = await db
      .insert(datasets)
      .values({ projectId, name: definition.name, description: definition.description })
      .returning({ id: datasets.id });
    if (!dataset) throw new Error(`Could not create dataset ${definition.name}`);
    const rows = Array.from({ length: definition.size }, (_, index) => {
      const template = definition.items[index % definition.items.length];
      if (!template) throw new Error('Dataset catalog is empty');
      const [input, expected, source] = template;
      const variant = index < definition.items.length ? '' : ` (case ${index + 1})`;

      return {
        datasetId: dataset.id,
        input: { message: `${input}${variant}` },
        expected: { answer: expected },
        source: SOURCE_BY_CATALOG[source],
        createdAt: daysAgo(now, index * 0.4 + random.next()),
      };
    });
    const inserted = [];
    for (const part of chunk(rows, INSERT_CHUNK_SIZE)) {
      inserted.push(
        ...(await db.insert(datasetItems).values(part).returning({ id: datasetItems.id })),
      );
    }
    itemIdsByDataset.set(definition.name, {
      datasetId: dataset.id,
      itemIds: inserted.map(({ id }) => id),
    });
  }

  return itemIdsByDataset;
}

export const DEMO_SCORERS: ScorerConfig[] = [
  {
    name: 'Correct tool call',
    kind: 'llm_judge',
    model: 'claude-sonnet-4-5',
    rubric: 'Score 1–5: did the agent call the right tool with the right arguments?',
  },
  {
    name: 'Refund within limit',
    kind: 'regex',
    pattern: '^(?!.*issue_refund\\([^)]*[5-9]\\d{2}\\.)',
  },
  {
    name: 'Valid JSON arguments',
    kind: 'json_schema',
    schema: { type: 'object', properties: { charge_id: { type: 'string' } } },
  },
  {
    name: 'Helpfulness',
    kind: 'llm_judge',
    model: 'claude-sonnet-4-5',
    rubric: 'Score 1–5: how helpful is the reply to the customer?',
  },
];

const EVAL_TARGETS = {
  v7: { tool: 4.0, limit: 0.942, json: 0.967, help: 4.3, latency: 3_400 },
  v8: { tool: 4.5, limit: 1, json: 0.992, help: 4.0, latency: 3_600 },
} as const;

function judgeScore(random: Random, mean: number): number {
  return Math.min(5, Math.max(1, Math.round(random.normal(mean, 0.7))));
}

async function seedEvalRuns(
  db: DbOrTransaction,
  projectId: string,
  now: Date,
  random: Random,
  dataset: { datasetId: string; itemIds: string[] },
  versions: { v7: string; v8: string },
) {
  for (const key of ['v7', 'v8'] as const) {
    const target = EVAL_TARGETS[key];
    const startedAt = new Date(now.getTime() - (key === 'v7' ? 2 : 1) * EVAL_GAP_MS - 3_600_000);
    const results = dataset.itemIds.map((itemId, index) => {
      const scripted = EVAL_ITEMS[index];
      const toolScore = scripted
        ? key === 'v7'
          ? scripted[2]
          : scripted[3]
        : judgeScore(random, target.tool);

      return {
        itemId,
        output: { text: scripted ? (key === 'v7' ? scripted[0] : scripted[1]) : 'Reply sent' },
        scores: {
          'Correct tool call': toolScore,
          'Refund within limit': random.chance(target.limit) ? 1 : 0,
          'Valid JSON arguments': random.chance(target.json) ? 1 : 0,
          Helpfulness: judgeScore(random, target.help),
        },
        cost: EVAL_ITEM_COST * (key === 'v8' ? 1.06 : 1),
        latencyMs: Math.round(Math.max(800, random.normal(target.latency, 600))),
      };
    });
    const average = (name: string) =>
      results.reduce(
        (sum, result) => sum + (result.scores[name as keyof typeof result.scores] ?? 0),
        0,
      ) / results.length;
    const latencies = results.map(({ latencyMs }) => latencyMs).sort((left, right) => left - right);
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
    const [run] = await db
      .insert(evalRuns)
      .values({
        projectId,
        datasetId: dataset.datasetId,
        promptVersionId: versions[key],
        scorers: DEMO_SCORERS,
        status: 'completed',
        totalCost: results.reduce((sum, { cost }) => sum + cost, 0),
        summary: {
          itemCount: results.length,
          scores: Object.fromEntries(DEMO_SCORERS.map(({ name }) => [name, average(name)])),
          latencyP95Ms: latencies[p95Index] ?? 0,
          durationMs: EVAL_DURATION_MS[key],
        },
        startedAt,
        finishedAt: new Date(startedAt.getTime() + EVAL_DURATION_MS[key]),
        createdAt: startedAt,
      })
      .returning({ id: evalRuns.id });
    if (!run) throw new Error('Could not create the demo eval run');
    await db.insert(evalResults).values(results.map((result) => ({ ...result, runId: run.id })));
  }
}

async function insertTraces(db: DbOrTransaction, demoTraces: DemoTrace[]) {
  for (const part of chunk(demoTraces, INSERT_CHUNK_SIZE)) {
    await db.insert(traces).values(part.map(({ trace }) => trace));
    const spanRows = part.flatMap(({ spans: rows }) => rows);
    for (const spanPart of chunk(spanRows, INSERT_CHUNK_SIZE * 2)) {
      await db.insert(spans).values(spanPart);
    }
  }
}

function buildWeekOfTraces(
  random: Random,
  projectId: string,
  now: Date,
  tracesPerDay: number,
  promptVersionIds: { supportReply: string; refundAgent: string },
): DemoTrace[] {
  const result: DemoTrace[] = [];
  for (let day = 0; day < DEMO_DAYS; day += 1) {
    const dayStart = daysAgo(now, DEMO_DAYS - day);
    const weekFactor = day < DAY_VOLUME_FACTORS.length ? PREVIOUS_WEEK_VOLUME : 1;
    const factor = (DAY_VOLUME_FACTORS[day % DAY_VOLUME_FACTORS.length] ?? 1) * weekFactor;
    const count = Math.round(tracesPerDay * factor);
    for (let index = 0; index < count; index += 1) {
      const startedAt = new Date(dayStart.getTime() + random.next() * MS_PER_DAY);
      if (startedAt > now) continue;
      result.push(buildDemoTrace({ random, projectId, startedAt, promptVersionIds }));
    }
  }

  return result;
}

export async function seedDemoData(db: Db, options: DemoSeedOptions) {
  const now = options.now ?? new Date();
  const random = createRandom(options.seed ?? DEFAULT_SEED);
  const tracesPerDay = options.tracesPerDay ?? DEFAULT_TRACES_PER_DAY;
  const { projectId } = options;

  await seedModelPrices(db);
  await ensureSpanPartitions(db, monthsBetween(daysAgo(now, DEMO_DAYS + 1), now));

  return db.transaction(async (tx) => {
    const promptIds = await seedPrompts(tx, projectId, now);
    const datasetIds = await seedDatasets(tx, projectId, now, random);
    const refundDataset = datasetIds.get('refund-edge-cases');
    if (!refundDataset) throw new Error('Demo dataset refund-edge-cases is missing');
    await seedEvalRuns(tx, projectId, now, random, refundDataset, {
      v7: promptIds.refundAgent,
      v8: promptIds.refundV8,
    });
    const demoTraces = buildWeekOfTraces(random, projectId, now, tracesPerDay, promptIds);
    await insertTraces(tx, demoTraces);

    return { traceCount: demoTraces.length };
  });
}
