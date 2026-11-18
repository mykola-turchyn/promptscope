import type { ReactNode } from 'react';
import { Form } from 'react-router';
import { Button, ButtonLink, buttonVariants } from '~/components/ui/Button';
import { Icon } from '~/components/ui/Icon';
import { PageHeading } from '~/components/ui/Misc';

const codeBoxClasses =
  'm-0 overflow-x-auto rounded-control border border-border bg-code-bg px-4 py-3.5 font-mono text-[13px] leading-[1.6]';

function Keyword({ children }: { children: ReactNode }) {
  return <span className="text-accent-text">{children}</span>;
}

function Str({ children }: { children: ReactNode }) {
  return <span className="text-c2">{children}</span>;
}

function Step({
  number,
  done,
  title,
  description,
  children,
}: {
  number: number;
  done?: boolean;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3.5 border-b border-border p-[18px]">
      {done ? (
        <span className="flex size-7 flex-none items-center justify-center rounded-full bg-success text-surface">
          <Icon name="check" size={14} strokeWidth={3} />
          <span className="sr-only">Done:</span>
        </span>
      ) : (
        <span className="flex size-7 flex-none items-center justify-center rounded-full border border-border bg-surface text-[13px] font-semibold text-fg">
          {number}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h3 className="m-0 text-[15px] font-semibold">{title}</h3>
          <span className="text-muted">{description}</span>
        </div>
        {children}
      </div>
    </li>
  );
}

export function Quickstart({
  keyPrefix,
  ingestUrl,
  docsUrl,
  settingsPath,
  canEdit,
}: {
  keyPrefix: string | null;
  ingestUrl: string;
  docsUrl: string;
  settingsPath: string;
  canEdit: boolean;
}) {
  return (
    <div className="box-border flex w-full max-w-[880px] flex-col gap-5 p-7">
      <PageHeading
        title="Send your first trace"
        description="This project has no data yet. Three steps, about five minutes."
      />
      <ol className="m-0 list-none overflow-hidden rounded-card border border-border bg-surface p-0">
        <Step
          number={1}
          done={Boolean(keyPrefix)}
          title="Create an API key"
          description={
            keyPrefix
              ? 'Done. The key is stored as a hash, so use the value you copied when you created it.'
              : 'The SDK sends traces with a project API key.'
          }
        >
          {keyPrefix ? (
            <code className="self-start rounded-control border border-border bg-code-bg px-2.5 py-1.5 font-mono text-[13px]">
              PROMPTSCOPE_API_KEY={keyPrefix}
              <br />
              PROMPTSCOPE_BASE_URL={ingestUrl}
            </code>
          ) : (
            <ButtonLink to={settingsPath} variant="primary" icon="plus" className="self-start">
              Create key
            </ButtonLink>
          )}
        </Step>
        <Step
          number={2}
          title="Install the SDK"
          description="Node 20+, works with ESM and CommonJS."
        >
          <pre className={codeBoxClasses}>
            <code>pnpm add @promptscope/sdk</code>
          </pre>
        </Step>
        <Step
          number={3}
          title="Wrap your client"
          description="Calls keep their original types. Telemetry errors never reach your app."
        >
          <pre className={codeBoxClasses}>
            <code>
              <Keyword>import</Keyword> OpenAI <Keyword>from</Keyword> <Str>"openai"</Str>;{'\n'}
              <Keyword>import</Keyword> {'{ Promptscope, wrapOpenAI }'} <Keyword>from</Keyword>{' '}
              <Str>"@promptscope/sdk"</Str>;{'\n\n'}
              <Keyword>const</Keyword> ps = <Keyword>new</Keyword> Promptscope({'{'} apiKey:
              process.env.PROMPTSCOPE_API_KEY {'}'});{'\n'}
              <Keyword>const</Keyword> openai = wrapOpenAI(<Keyword>new</Keyword> OpenAI());{'\n\n'}
              <span className="text-subtle">
                {'// Every call inside the trace becomes a span with tokens, cost and latency'}
              </span>
              {'\n'}
              <Keyword>await</Keyword> ps.trace(<Str>"support.answer"</Str>,{' '}
              <Keyword>async</Keyword> () =&gt; {'{'}
              {'\n  '}
              <Keyword>return</Keyword> openai.chat.completions.create({'{'} model:{' '}
              <Str>"gpt-4.1-mini"</Str>, messages {'}'});{'\n'}
              {'});'}
            </code>
          </pre>
        </Step>
        <li className="flex flex-wrap items-center justify-between gap-3 bg-surface-2 px-[18px] py-4">
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2.5 font-medium"
          >
            <span className="size-2.5 animate-pulse rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
            Waiting for the first trace…
          </span>
          <span className="text-[13px] text-muted">
            This page updates by itself when data arrives.
          </span>
        </li>
      </ol>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-border px-[18px] py-4">
        <div className="flex flex-[1_1_320px] flex-col gap-0.5">
          <strong className="font-semibold">Just looking around?</strong>
          <span className="text-muted">
            Load a week of synthetic traces, prompts and an eval run into this project.
          </span>
        </div>
        {canEdit && (
          <Form method="post" action="demo-data">
            <Button type="submit">Load demo data</Button>
          </Form>
        )}
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'primary' })}
        >
          Read the docs
        </a>
      </div>
    </div>
  );
}
