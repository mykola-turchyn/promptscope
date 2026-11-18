import { redirect } from 'react-router';
import { auth } from '~/.server/auth';
import type { Route } from './+types/sign-out';

export async function action({ request }: Route.ActionArgs) {
  const response = await auth.api.signOut({ headers: request.headers, asResponse: true });

  throw redirect('/sign-in', { headers: response.headers });
}
