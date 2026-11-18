import { schema } from '@promptscope/db';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';

export async function listUserProjects(userId: string) {
  return db
    .select({
      orgName: schema.organization.name,
      orgSlug: schema.organization.slug,
      projectName: schema.projects.name,
      projectSlug: schema.projects.slug,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .innerJoin(schema.projects, eq(schema.projects.orgId, schema.organization.id))
    .where(eq(schema.member.userId, userId))
    .orderBy(asc(schema.organization.name), asc(schema.projects.name));
}

export async function firstProjectPath(userId: string): Promise<string | null> {
  const [first] = await listUserProjects(userId);

  return first ? `/${first.orgSlug}/${first.projectSlug}` : null;
}
