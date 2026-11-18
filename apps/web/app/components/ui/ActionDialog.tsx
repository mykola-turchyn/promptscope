import { type ReactNode, useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button, type ButtonProps } from './Button';
import { Dialog } from './Dialog';

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

// A button that opens a dialog with a form; the form posts through a fetcher and the dialog closes
// once the action answers `{ ok: true }`. Pass `fetcherKey` to read the result elsewhere on the page.
export function ActionDialog({
  trigger,
  title,
  intent,
  submitLabel,
  encType,
  fetcherKey,
  children,
}: {
  trigger: ButtonProps;
  title: string;
  intent: string;
  submitLabel: string;
  encType?: 'multipart/form-data';
  fetcherKey?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<ActionResult>({ key: fetcherKey });
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) setOpen(false);
  }, [fetcher.state, fetcher.data]);

  return (
    <>
      <Button {...trigger} onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <fetcher.Form method="post" encType={encType} className="flex flex-col gap-4">
          <input type="hidden" name="intent" value={intent} />
          {children}
          {fetcher.data?.error && (
            <p role="alert" className="m-0 text-danger">
              {fetcher.data.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {submitLabel}
            </Button>
          </div>
        </fetcher.Form>
      </Dialog>
    </>
  );
}
