import { randomUUID } from 'node:crypto';
import { schema } from '@promptscope/db';
import { DEMO_ORG, DEMO_PROJECT } from '@promptscope/db/demo';
import { randomString } from '@promptscope/shared';
import { eq } from 'drizzle-orm';
import { db } from './db';

export const DEMO_EMAIL = 'demo@promptscope.dev';
const DEFAULT_PROJECT = { name: 'my-app', slug: 'my-app' };
const SLUG_SUFFIX_LENGTH = 4;
const MAX_SLUG_BASE_LENGTH = 32;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_BASE_LENGTH);
}

async function joinDemoOrganization(userId: string) {
  const [org] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, DEMO_ORG.slug));
  if (!org) throw new Error('Run pnpm db:seed to create the demo project first');
  await db
    .insert(schema.member)
    .values({ id: randomUUID(), organizationId: org.id, userId, role: 'member' });
}

export async function createPersonalWorkspace(user: { id: string; name: string; email: string }) {
  if (user.email === DEMO_EMAIL) {
    await joinDemoOrganization(user.id);

    return;
  }
  const base = slugify(user.name || user.email.split('@')[0] || 'workspace') || 'workspace';
  const orgId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.organization).values({
      id: orgId,
      name: user.name || base,
      slug: `${base}-${randomString(SLUG_SUFFIX_LENGTH)}`,
    });
    await tx
      .insert(schema.member)
      .values({ id: randomUUID(), organizationId: orgId, userId: user.id, role: 'owner' });
    await tx.insert(schema.projects).values({ orgId, ...DEFAULT_PROJECT });
  });
}

export { DEMO_ORG, DEMO_PROJECT };
