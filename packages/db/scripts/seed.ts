import { createDb } from '../src/client.ts';
import { ensureDemoProject, seedDemoData, seedModelPrices } from '../src/demo/index.ts';
import { requireEnv } from './env.ts';

const { db, close } = createDb(requireEnv('DATABASE_URL'), 2);
await seedModelPrices(db);
const { projectId, created } = await ensureDemoProject(db);
if (created) {
  const started = performance.now();
  const { traceCount } = await seedDemoData(db, { projectId });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`Demo project seeded with ${traceCount} traces in ${seconds} s`);
} else {
  console.log('Demo project already exists, skipping demo data');
}
await close();
