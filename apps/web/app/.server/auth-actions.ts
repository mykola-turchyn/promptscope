import { data, redirect } from 'react-router';
import { safeRedirectPath } from '~/lib/redirect';
import { auth, isGitHubEnabled } from './auth';
import { setCookieHeaders } from './cookies';

const HTTP_BAD_REQUEST = 400;

export interface AuthActionData {
  error: string;
  fields?: Record<string, string>;
}

export async function signInWithGitHub(redirectTo: string) {
  if (!isGitHubEnabled) {
    return data<AuthActionData>(
      { error: 'GitHub sign-in is not configured on this server. Use email instead.' },
      { status: HTTP_BAD_REQUEST },
    );
  }
  const response = await auth.api.signInSocial({
    body: { provider: 'github', callbackURL: redirectTo },
    asResponse: true,
  });
  const { url } = (await response.json()) as { url: string };

  throw redirect(url, { headers: setCookieHeaders(response) });
}

export function redirectAfterAuth(response: Response, form: FormData): never {
  throw redirect(safeRedirectPath(form.get('redirectTo')), { headers: setCookieHeaders(response) });
}

export function formString(form: FormData, name: string): string {
  const value = form.get(name);

  return typeof value === 'string' ? value.trim() : '';
}
