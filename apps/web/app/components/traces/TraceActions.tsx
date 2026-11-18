import { useState } from 'react';
import { useFetcher } from 'react-router';
import { ActionDialog } from '~/components/ui/ActionDialog';
import { Button } from '~/components/ui/Button';
import { Field, Select } from '~/components/ui/Field';
import { Icon } from '~/components/ui/Icon';
import { cn } from '~/lib/cn';

const COPIED_MS = 1_500;
const GOOD = 1;
const BAD = 0;
const READ_ONLY_TITLE = 'Your role in this project is read-only';

function RatingButtons({ rating, canEdit }: { rating: number | null; canEdit: boolean }) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get('value');
  const current = pending === undefined || pending === null ? rating : Number(pending);
  const options = [
    { value: GOOD, icon: 'thumbsUp' as const, label: 'Rate trace as good', tone: 'text-success' },
    { value: BAD, icon: 'thumbsDown' as const, label: 'Rate trace as bad', tone: 'text-danger' },
  ];

  return (
    <fetcher.Form method="post" className="flex gap-2">
      <input type="hidden" name="intent" value="rate" />
      {options.map((option) => (
        <Button
          key={option.value}
          type="submit"
          name="value"
          value={option.value}
          size="icon"
          aria-label={option.label}
          aria-pressed={current === option.value}
          disabled={!canEdit}
          title={canEdit ? option.label : READ_ONLY_TITLE}
          className={cn(current === option.value && ['bg-surface-2', option.tone])}
        >
          <Icon name={option.icon} />
        </Button>
      ))}
    </fetcher.Form>
  );
}

function CopyTraceId({ traceId }: { traceId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={async () => {
        await navigator.clipboard.writeText(traceId);
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_MS);
      }}
    >
      <span aria-live="polite">{copied ? 'Copied' : 'Copy trace ID'}</span>
    </Button>
  );
}

function AddToDataset({
  datasets,
  canEdit,
}: {
  datasets: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const disabledReason = !canEdit
    ? READ_ONLY_TITLE
    : datasets.length === 0
      ? 'Create a dataset first'
      : undefined;

  return (
    <ActionDialog
      trigger={{
        children: 'Add to dataset',
        variant: 'primary',
        icon: 'plus',
        disabled: Boolean(disabledReason),
        title: disabledReason,
      }}
      title="Add to dataset"
      intent="add-to-dataset"
      submitLabel="Add item"
    >
      <p className="m-0 text-muted">
        The trace input becomes the item input, its output the expected answer.
      </p>
      <Field label="Dataset">
        {(props) => (
          <Select {...props} name="datasetId" required>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </ActionDialog>
  );
}

export function TraceActions({
  traceId,
  rating,
  datasets,
  canEdit,
}: {
  traceId: string;
  rating: number | null;
  datasets: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RatingButtons rating={rating} canEdit={canEdit} />
      <CopyTraceId traceId={traceId} />
      <AddToDataset datasets={datasets} canEdit={canEdit} />
    </div>
  );
}
