import { schema } from '@promptscope/db';
import { seedDemoData } from '@promptscope/db/demo';
import { eq } from 'drizzle-orm';
import { data, redirect } from 'react-router';
import { requireEditor } from '~/.server/context';
import { db } from '~/.server/db';
import { projectPath } from '~/lib/paths';
import type { Route } from './+types/demo-data';

const HTTP_CONFLICT = 409;
const DEMO_TRACES_PER_DAY = 600;

export async function action({ context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const [existing] = await db
    .select({ id: schema.prompts.id })
    .from(schema.prompts)
    .where(eq(schema.prompts.projectId, project.id))
    .limit(1);
  if (existing) {
    return data(
      { error: 'This project already has prompts, so demo data was not loaded.' },
      { status: HTTP_CONFLICT },
    );
  }
  await seedDemoData(db, {
    projectId: project.id,
    tracesPerDay: DEMO_TRACES_PER_DAY,
    seed: Date.now(),
  });

  throw redirect(projectPath(params));
}
