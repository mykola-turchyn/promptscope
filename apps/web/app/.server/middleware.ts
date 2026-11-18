import { schema } from '@promptscope/db';
import { and, eq } from 'drizzle-orm';
import { data, type MiddlewareFunction } from 'react-router';
import { isEditorRole, projectContext, requireSession, sessionContext } from './context';
import { db } from './db';

const HTTP_NOT_FOUND = 404;

export const requireUserMiddleware: MiddlewareFunction<Response> = async ({ request, context }) => {
  context.set(sessionContext, await requireSession(request));
};

// The only place a project is resolved from the URL: every loader and action below reads the
// project from context, so a user can never reach a project of an organization they are not in.
export const requireProjectMiddleware: MiddlewareFunction<Response> = async ({
  params,
  context,
}) => {
  const { user } = context.get(sessionContext);
  const [row] = await db
    .select({
      org: {
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
      },
      project: {
        id: schema.projects.id,
        name: schema.projects.name,
        slug: schema.projects.slug,
        retentionDays: schema.projects.retentionDays,
      },
      role: schema.member.role,
    })
    .from(schema.projects)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.projects.orgId))
    .innerJoin(
      schema.member,
      and(
        eq(schema.member.organizationId, schema.organization.id),
        eq(schema.member.userId, user.id),
      ),
    )
    .where(
      and(
        eq(schema.organization.slug, params.org ?? ''),
        eq(schema.projects.slug, params.project ?? ''),
      ),
    );
  if (!row) throw data('Project not found', { status: HTTP_NOT_FOUND });
  const role = isEditorRole(row.role) ? row.role : 'member';
  context.set(projectContext, { ...row, role, canEdit: isEditorRole(row.role) });
};
