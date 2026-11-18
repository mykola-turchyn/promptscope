import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const HIGHLIGHTS = [
  { label: 'Time to first trace', value: '< 5 min' },
  { label: 'SDK overhead', value: 'Non-blocking' },
];

export function AuthLayout({ titleId, children }: { titleId: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-fg">
      <main className="flex min-w-0 flex-[999_1_560px] flex-col">
        <div className="flex min-h-screen flex-1 flex-wrap">
          <section
            aria-label="About Promptscope"
            className="box-border flex flex-[1_1_520px] flex-col justify-between gap-10 border-r border-border bg-surface-2 p-12"
          >
            <Logo size="md" />
            <div className="flex max-w-[480px] flex-col gap-4">
              <p className="m-0 text-[32px] font-semibold leading-[1.15] tracking-[-0.025em]">
                See every LLM call. Ship prompt changes with evidence.
              </p>
              <p className="m-0 text-[15px] text-muted">
                Traces, cost and latency for your AI features, plus evals that catch regressions
                before your users do.
              </p>
            </div>
            <dl className="m-0 flex flex-wrap gap-8">
              {HIGHLIGHTS.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[13px] text-subtle">{label}</dt>
                  <dd className="tabular mt-1 mb-0 text-xl font-semibold">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-[13px] text-subtle">Self-host</dt>
                <dd className="mt-1 mb-0 font-mono text-base leading-[30px] font-semibold">
                  docker compose up
                </dd>
              </div>
            </dl>
          </section>
          <section
            aria-labelledby={titleId}
            className="box-border flex flex-[1_1_440px] flex-col px-12 pt-6 pb-12"
          >
            <div className="flex justify-end">
              <ThemeToggle />
            </div>
            <div className="flex flex-1 items-center justify-center">{children}</div>
          </section>
        </div>
      </main>
    </div>
  );
}
