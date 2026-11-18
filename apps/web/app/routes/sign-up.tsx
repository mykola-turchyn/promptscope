import { data, redirect } from 'react-router';
import { auth } from '~/.server/auth';
import {
  type AuthActionData,
  formString,
  redirectAfterAuth,
  signInWithGitHub,
} from '~/.server/auth-actions';
import { getSession } from '~/.server/context';
import { AuthForm } from '~/components/auth/AuthForm';
import { AuthLayout } from '~/components/layout/AuthLayout';
import { Field, Input } from '~/components/ui/Field';
import type { Route } from './+types/sign-up';

const HTTP_BAD_REQUEST = 400;
const MIN_PASSWORD_LENGTH = 8;
const TITLE_ID = 'signup-title';

export const meta: Route.MetaFunction = () => [{ title: 'Create an account · Promptscope' }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSession(request)) throw redirect('/');

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get('intent') === 'github') return signInWithGitHub('/');

  const name = formString(form, 'name');
  const email = formString(form, 'email');
  const password = String(form.get('password') ?? '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return data<AuthActionData>(
      {
        error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
        fields: { name, email },
      },
      { status: HTTP_BAD_REQUEST },
    );
  }
  const response = await auth.api.signUpEmail({
    body: { name, email, password },
    asResponse: true,
  });
  if (!response.ok) {
    return data<AuthActionData>(
      {
        error: 'Could not create the account. The email may already be registered.',
        fields: { name, email },
      },
      { status: HTTP_BAD_REQUEST },
    );
  }

  return redirectAfterAuth(response, form);
}

export default function SignUp({ actionData }: Route.ComponentProps) {
  return (
    <AuthLayout titleId={TITLE_ID}>
      <AuthForm
        titleId={TITLE_ID}
        title="Create an account"
        switchPrompt="Already have one?"
        switchLabel="Sign in"
        switchTo="/sign-in"
        redirectTo="/"
        formError={actionData?.error}
        submitLabel="Create account"
      >
        <Field label="Name">
          {(props) => (
            <Input
              {...props}
              name="name"
              autoComplete="name"
              required
              defaultValue={actionData?.fields?.name}
              className="h-10"
            />
          )}
        </Field>
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
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
          {(props) => (
            <Input
              {...props}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="h-10"
            />
          )}
        </Field>
      </AuthForm>
    </AuthLayout>
  );
}
