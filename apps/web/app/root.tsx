import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type { Route } from './+types/root';
import './app.css';
import { ButtonLink } from './components/ui/Button';
import { readThemeCookie } from './lib/theme';
import { readTimeZoneCookie, useSyncTimeZone } from './lib/time-zone';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
  },
];

export function loader({ request }: Route.LoaderArgs) {
  const cookie = request.headers.get('cookie');

  return { theme: readThemeCookie(cookie), timeZone: readTimeZoneCookie(cookie) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');

  return (
    <html lang="en" className={data?.theme ?? undefined}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  useSyncTimeZone(loaderData.timeZone);

  return <Outlet />;
}

export function meta() {
  return [{ title: 'Promptscope' }];
}

const STATUS_TITLES: Record<number, string> = {
  403: 'No access',
  404: 'Not found',
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isResponse = isRouteErrorResponse(error);
  const title = isResponse
    ? (STATUS_TITLES[error.status] ?? `Error ${error.status}`)
    : 'Something went wrong';
  const message = isResponse
    ? typeof error.data === 'string'
      ? error.data
      : 'The page could not be loaded.'
    : 'An unexpected error occurred. Try again in a moment.';

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-7">
      <div className="flex max-w-md flex-col items-start gap-3">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="m-0 text-muted">{message}</p>
        <ButtonLink to="/" variant="primary">
          Go to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
