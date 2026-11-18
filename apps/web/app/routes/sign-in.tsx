import { data, redirect } from 'react-router';
import { auth } from '~/.server/auth';
import {
  type AuthActionData,
  formString,
  redirectAfterAuth,
  signInWithGitHub,
} from '~/.server/auth-actions';
import { getSession } from '~/.server/context';
import { AuthForm, DemoAccess } from '~/components/auth/AuthForm';
import { AuthLayout } from '~/components/layout/AuthLayout';
import { Field, Input } from '~/components/ui/Field';
import { safeRedirectPath } from '~/lib/redirect';
import type { Route } from './+types/sign-in';

const HTTP_UNAUTHORIZED = 401;
const TITLE_ID = 'signin-title';

export const meta: Route.MetaFunction = () => [{ title: 'Sign in · Promptscope' }];

export async function loader({ request }: Route.LoaderArgs) {
  const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get('redirectTo'));
  if (await getSession(request)) throw redirect(redirectTo);

  return { redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const redirectTo = safeRedirectPath(form.get('redirectTo'));
  if (form.get('intent') === 'github') return signInWithGitHub(redirectTo);

  const email = formString(form, 'email');
  const response = await auth.api.signInEmail({
    body: { email, password: String(form.get('password') ?? '') },
    asResponse: true,
  });
  if (!response.ok) {
    return data<AuthActionData>(
      { error: 'Email or password is incorrect.', fields: { email } },
      { status: HTTP_UNAUTHORIZED },
    );
  }

  return redirectAfterAuth(response, form);
}

export default function SignIn({ loaderData, actionData }: Route.ComponentProps) {
  const passwordError = actionData?.fields ? actionData.error : undefined;

  return (
    <AuthLayout titleId={TITLE_ID}>
      <AuthForm
        titleId={TITLE_ID}
        title="Sign in"
        switchPrompt="New here?"
        switchLabel="Create an account"
        switchTo="/sign-up"
        redirectTo={loaderData.redirectTo}
        formError={passwordError ? undefined : actionData?.error}
        submitLabel="Sign in"
        footer={<DemoAccess />}
      >
        <Field label="Email">
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={actionData?.fields?.email}
              className="h-10"
            />
          )}
        </Field>
        <Field label="Password" error={passwordError}>
          {(props) => (
            <Input
              {...props}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={passwordError ? 'h-10 border-danger' : 'h-10'}
            />
          )}
        </Field>
      </AuthForm>
    </AuthLayout>
  );
}
