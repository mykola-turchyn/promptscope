import { redirect } from 'react-router';
import { projectPath } from '~/lib/paths';
import type { Route } from './+types/settings-index';

export function loader({ params }: Route.LoaderArgs) {
  throw redirect(projectPath(params, 'settings/keys'));
}
