import { Outlet } from 'react-router';
import { projectContext, sessionContext } from '~/.server/context';
import { requireProjectMiddleware, requireUserMiddleware } from '~/.server/middleware';
import { listUserProjects } from '~/.server/queries/workspace';
import { AppShell } from '~/components/layout/AppShell';
import type { Route } from './+types/layout';

export const middleware: Route.MiddlewareFunction[] = [
  requireUserMiddleware,
  requireProjectMiddleware,
];

export async function loader({ context }: Route.LoaderArgs) {
  const { user } = context.get(sessionContext);
  const { org, project, role, canEdit } = context.get(projectContext);

  return {
    user: { name: user.name },
    role,
    canEdit,
    current: {
      orgName: org.name,
      orgSlug: org.slug,
      projectName: project.name,
      projectSlug: project.slug,
    },
    projects: await listUserProjects(user.id),
  };
}

export default function ProjectLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell {...loaderData}>
      <Outlet />
    </AppShell>
  );
}
