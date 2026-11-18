import { schema } from '@promptscope/db';
import { apiKeyCacheKey, generateApiKey } from '@promptscope/shared/api-keys';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { redis } from '../redis';

export const RETENTION_OPTIONS = [30, 90, 180, 365] as const;

export async function listApiKeys(projectId: string) {
  return db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      prefix: schema.apiKeys.prefix,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
    })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.projectId, projectId), isNull(schema.apiKeys.revokedAt)))
    .orderBy(desc(schema.apiKeys.createdAt));
}

export async function createApiKey(projectId: string, name: string, userId: string) {
  const generated = generateApiKey();
  await db.insert(schema.apiKeys).values({
    projectId,
    name,
    keyHash: generated.hash,
    prefix: generated.prefix,
    createdBy: userId,
  });

  return generated.key;
}

export async function revokeApiKey(projectId: string, keyId: string) {
  const [revoked] = await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.apiKeys.projectId, projectId),
        eq(schema.apiKeys.id, keyId),
        isNull(schema.apiKeys.revokedAt),
      ),
    )
    .returning({ keyHash: schema.apiKeys.keyHash });
  if (revoked) await redis.del(apiKeyCacheKey(revoked.keyHash));

  return Boolean(revoked);
}

export async function updateProject(
  projectId: string,
  values: { name?: string; retentionDays?: number },
) {
  await db.update(schema.projects).set(values).where(eq(schema.projects.id, projectId));
}

export async function listMembers(orgId: string) {
  return db
    .select({
      id: schema.member.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(eq(schema.member.organizationId, orgId))
    .orderBy(asc(schema.user.name));
}

export async function listModelPrices() {
  return db
    .select()
    .from(schema.modelPrices)
    .orderBy(
      asc(schema.modelPrices.provider),
      asc(schema.modelPrices.model),
      desc(schema.modelPrices.validFrom),
    );
}
