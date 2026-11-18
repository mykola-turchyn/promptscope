import { schema } from '@promptscope/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { db } from './db';
import { env } from './env';
import { createPersonalWorkspace } from './workspace';

const MIN_PASSWORD_LENGTH = 8;

export const isGitHubEnabled = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD_LENGTH },
  socialProviders:
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
      : {},
  plugins: [organization()],
  databaseHooks: {
    user: { create: { after: (user) => createPersonalWorkspace(user) } },
  },
});

export type Session = typeof auth.$Infer.Session;
