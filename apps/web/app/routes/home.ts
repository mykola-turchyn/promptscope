import { redirect } from 'react-router';
import { getSession } from '~/.server/context';
import { firstProjectPath } from '~/.server/queries/workspace';
import type { Route } from './+types/home';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (!session) throw redirect('/sign-in');
  const path = await firstProjectPath(session.user.id);

  throw redirect(path ?? '/sign-in');
}
