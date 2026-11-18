import type { ReactNode } from 'react';
import { Form, Link, useNavigation } from 'react-router';
import { Button } from '~/components/ui/Button';
import { GitHubIcon } from '~/components/ui/Icon';

export function AuthForm({
  titleId,
  title,
  switchPrompt,
  switchLabel,
  switchTo,
  redirectTo,
  formError,
  children,
  submitLabel,
  footer,
}: {
  titleId: string;
  title: string;
  switchPrompt: string;
  switchLabel: string;
  switchTo: string;
  redirectTo: string;
  formError?: string;
  submitLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4">
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex flex-col gap-1">
          <h1 id={titleId} className="m-0 text-2xl font-semibold tracking-[-0.02em]">
            {title}
          </h1>
          <p className="m-0 text-muted">
            {switchPrompt}{' '}
            <Link to={switchTo} className="font-medium text-accent-text">
              {switchLabel}
            </Link>
          </p>
        </div>
        <Button type="submit" name="intent" value="github" size="lg" formNoValidate>
          <GitHubIcon />
          Continue with GitHub
        </Button>
        <div className="flex items-center gap-3 text-xs text-subtle">
          <span className="h-px flex-1 bg-border" />
          or with email
          <span className="h-px flex-1 bg-border" />
        </div>
        {children}
        {formError && (
          <p role="alert" className="m-0 text-danger">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          name="intent"
          value="email"
          variant="primary"
          size="lg"
          disabled={busy}
        >
          {submitLabel}
        </Button>
      </Form>
      {footer}
    </div>
  );
}

export function DemoAccess() {
  return (
    <Form
      method="post"
      action="/demo"
      className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-3.5"
    >
      <span className="font-medium">Just want to look?</span>
      <span className="text-[13px] text-muted">
        Open a read-only demo project with live traces. No sign-up.
      </span>
      <Button type="submit" className="self-start">
        Open live demo
      </Button>
    </Form>
  );
}
