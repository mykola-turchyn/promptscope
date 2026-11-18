import { Form, NavLink } from 'react-router';
import { Icon, type IconName } from '~/components/ui/Icon';
import { cn } from '~/lib/cn';
import { Logo } from './Logo';

export interface SidebarProject {
  orgName: string;
  orgSlug: string;
  projectName: string;
  projectSlug: string;
}

const NAV_ITEMS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '', label: 'Overview', icon: 'overview', end: true },
  { to: 'traces', label: 'Traces', icon: 'traces' },
  { to: 'prompts', label: 'Prompts', icon: 'prompts' },
  { to: 'evals', label: 'Evals', icon: 'evals' },
  { to: 'datasets', label: 'Datasets', icon: 'datasets' },
];

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Read-only' };
const INITIALS_LENGTH = 2;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, INITIALS_LENGTH)
    .toUpperCase();
}

function SidebarLink({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-control px-2.5 font-medium no-underline',
          isActive ? 'bg-accent-soft text-accent-text' : 'text-muted',
        )
      }
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}

function ProjectSwitcher({
  current,
  projects,
}: {
  current: SidebarProject;
  projects: SidebarProject[];
}) {
  return (
    <details className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-control border border-border bg-surface px-2.5 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col leading-[1.2]">
          <span className="text-[11px] text-subtle">{current.orgName}</span>
          <span className="font-medium">{current.projectName}</span>
        </span>
        <Icon name="chevronsUpDown" size={14} />
      </summary>
      <ul className="absolute inset-x-0 top-11 z-10 m-0 flex list-none flex-col gap-0.5 rounded-control border border-border bg-surface p-1 shadow-lg">
        {projects.map((project) => (
          <li key={`${project.orgSlug}/${project.projectSlug}`}>
            <a
              href={`/${project.orgSlug}/${project.projectSlug}`}
              className="flex flex-col rounded-md px-2 py-1.5 leading-[1.2] text-fg no-underline hover:bg-surface-2"
            >
              <span className="text-[11px] text-subtle">{project.orgName}</span>
              <span className="font-medium">{project.projectName}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Sidebar({
  current,
  projects,
  user,
  role,
}: {
  current: SidebarProject;
  projects: SidebarProject[];
  user: { name: string };
  role: string;
}) {
  return (
    <aside className="box-border flex flex-[1_1_220px] flex-col gap-5 border-r border-border bg-surface px-3 py-4">
      <Logo className="px-1.5 py-1" />
      <ProjectSwitcher current={current} projects={projects} />
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.label} {...item} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5">
        <SidebarLink to="settings" label="Settings" icon="settings" />
        <details className="relative mt-2 border-t border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 p-2.5 [&::-webkit-details-marker]:hidden">
            <span className="flex size-7 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-muted">
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-subtle">{ROLE_LABELS[role] ?? role}</span>
            </span>
          </summary>
          <Form
            method="post"
            action="/sign-out"
            className="absolute inset-x-0 bottom-14 rounded-control border border-border bg-surface p-1 shadow-lg"
          >
            <button
              type="submit"
              className="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-fg [font:inherit] hover:bg-surface-2"
            >
              Sign out
            </button>
          </Form>
        </details>
      </div>
    </aside>
  );
}
