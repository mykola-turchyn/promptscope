import { redirect } from 'react-router';
import { auth } from '~/.server/auth';
import { setCookieHeaders } from '~/.server/cookies';
import { env } from '~/.server/env';
import { DEMO_EMAIL, DEMO_ORG, DEMO_PROJECT } from '~/.server/workspace';
import type { Route } from './+types/demo';

const DEMO_NAME = 'Demo visitor';

async function signInDemo() {
  return auth.api.signInEmail({
    body: { email: DEMO_EMAIL, password: env.DEMO_USER_PASSWORD },
    asResponse: true,
  });
}

export async function action(_: Route.ActionArgs) {
  let response = await signInDemo();
  if (!response.ok) {
    response = await auth.api.signUpEmail({
      body: { name: DEMO_NAME, email: DEMO_EMAIL, password: env.DEMO_USER_PASSWORD },
      asResponse: true,
    });
  }
  if (!response.ok) throw new Error('The demo account is not available. Run pnpm db:seed first.');

  throw redirect(`/${DEMO_ORG.slug}/${DEMO_PROJECT.slug}`, { headers: setCookieHeaders(response) });
}
