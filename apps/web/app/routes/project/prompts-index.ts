import { redirect } from 'react-router';
import { projectContext } from '~/.server/context';
import { listPrompts } from '~/.server/queries/prompts';
import { projectPath } from '~/lib/paths';
import type { Route } from './+types/prompts-index';

export async function loader({ context, params }: Route.LoaderArgs) {
  const { project, canEdit } = context.get(projectContext);
  const [first] = await listPrompts(project.id);
  if (first) throw redirect(projectPath(params, `prompts/${first.name}`));
  if (canEdit) throw redirect(projectPath(params, 'prompts/new'));

  throw redirect(projectPath(params));
}
