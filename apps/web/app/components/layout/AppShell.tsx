import type { ReactNode } from 'react';
import { useMatches } from 'react-router';
import { Badge } from '~/components/ui/Badge';
import { cn } from '~/lib/cn';
import { isShellHandle } from '~/lib/route-handle';
import { useLiveUpdates } from '~/lib/use-live-updates';
import { Sidebar, type SidebarProject } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

function useShellHeader() {
  const match = useMatches().findLast((candidate) => isShellHandle(candidate.handle));
  if (!match || !isShellHandle(match.handle)) {
    return { breadcrumb: '', live: false, liveBadge: false, actions: null };
  }
  const { breadcrumb, live, liveBadge = live, HeaderActions } = match.handle;
  const data = match.loaderData;
  const resolve = (value: boolean | ((data: unknown) => boolean) | undefined) =>
    typeof value === 'function' ? value(data) : Boolean(value);

  return {
    breadcrumb: typeof breadcrumb === 'function' ? breadcrumb(data) : breadcrumb,
    live: resolve(live),
    liveBadge: resolve(liveBadge),
    actions: HeaderActions ? <HeaderActions data={data} /> : null,
  };
}

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <Badge tone={connected ? 'success' : 'neutral'} size="md" dot>
      {connected ? 'Live' : 'Reconnecting'}
    </Badge>
  );
}

export function AppShell({
  current,
  projects,
  user,
  role,
  children,
}: {
  current: SidebarProject;
  projects: SidebarProject[];
  user: { name: string };
  role: string;
  children: ReactNode;
}) {
  const header = useShellHeader();
  const basePath = `/${current.orgSlug}/${current.projectSlug}`;
  const connected = useLiveUpdates(`${basePath}/events`, header.live);

  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-fg">
      <Sidebar current={current} projects={projects} user={user} role={role} />
      <main className="flex min-w-0 flex-[999_1_560px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-7 py-3">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-[13px] text-subtle"
          >
            <span>{current.orgName}</span>
            <span aria-hidden="true">/</span>
            <span>{current.projectName}</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-fg">{header.breadcrumb}</span>
          </nav>
          <div className="flex items-center gap-2">
            {header.liveBadge && <LiveBadge connected={connected} />}
            {header.actions}
            <ThemeToggle />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function PageBody({
  maxWidth,
  children,
  className,
}: {
  maxWidth: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('box-border flex w-full flex-col gap-5 p-7', className)}
      style={{ maxWidth }}
    >
      {children}
    </div>
  );
}
