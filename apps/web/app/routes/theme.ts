import { data, redirect } from 'react-router';
import { isTheme, readThemeCookie, THEME_COOKIE } from '~/lib/theme';
import type { Route } from './+types/theme';

const ONE_YEAR_SECONDS = 31_536_000;

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const requested = form.get('theme');
  const current = readThemeCookie(request.headers.get('cookie'));
  const theme = isTheme(requested) ? requested : current === 'dark' ? 'light' : 'dark';
  const headers = {
    'set-cookie': `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`,
  };
  if (form.get('redirectTo')) {
    const target = String(form.get('redirectTo'));

    throw redirect(target.startsWith('/') ? target : '/', { headers });
  }

  return data({ theme }, { headers });
}
