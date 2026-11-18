import type { MemberRole } from '@promptscope/db/schema';
import { createContext, data, type RouterContextProvider, redirect } from 'react-router';
import { auth, type Session } from './auth';

export interface ProjectScope {
  org: { id: string; name: string; slug: string };
  project: { id: string; name: string; slug: string; retentionDays: number };
  role: MemberRole;
  canEdit: boolean;
}

export const sessionContext = createContext<Session>();
export const projectContext = createContext<ProjectScope>();

const HTTP_FORBIDDEN = 403;
const EDITOR_ROLES: readonly MemberRole[] = ['owner', 'admin'];

export function isEditorRole(role: string): role is MemberRole {
  return (EDITOR_ROLES as readonly string[]).includes(role);
}

export async function getSession(request: Request): Promise<Session | null> {
  return auth.api.getSession({ headers: request.headers });
}

export async function requireSession(request: Request): Promise<Session> {
  const session = await getSession(request);
  if (!session) {
    const url = new URL(request.url);
    const redirectTo = `${url.pathname}${url.search}`;
    throw redirect(`/sign-in?${new URLSearchParams({ redirectTo })}`);
  }

  return session;
}

export function requireEditor(context: Readonly<RouterContextProvider>): ProjectScope {
  const scope = context.get(projectContext);
  if (!scope.canEdit) {
    throw data({ error: 'Your role in this project is read-only.' }, { status: HTTP_FORBIDDEN });
  }

  return scope;
}
