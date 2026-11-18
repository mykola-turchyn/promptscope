import { redirect } from 'react-router';
import { projectContext } from '~/.server/context';
import { listDatasets } from '~/.server/queries/datasets';
import { projectPath } from '~/lib/paths';
import type { Route } from './+types/datasets-index';

export async function loader({ context, params }: Route.LoaderArgs) {
  const { project } = context.get(projectContext);
  const [first] = await listDatasets(project.id);

  throw redirect(projectPath(params, first ? `datasets/${first.id}` : 'datasets/new'));
}
