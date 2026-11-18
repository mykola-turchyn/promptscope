import { ActionDialog } from '~/components/ui/ActionDialog';
import { Field, Input, Select, Textarea } from '~/components/ui/Field';

const TEXTAREA_ROWS = 4;
const DEFAULT_COST_LIMIT = 5;
const DEFAULT_JUDGE_MODEL = 'claude-sonnet-4-5';
const DEFAULT_RUBRIC = 'Score 1–5: how well does the answer match the expected behaviour?';

export function AddItemDialog() {
  return (
    <ActionDialog
      trigger={{ children: 'Add item' }}
      title="Add item"
      intent="add-item"
      submitLabel="Add item"
    >
      <Field label="Input" hint="Plain text becomes a chat message. JSON is stored as is.">
        {(props) => <Textarea {...props} name="input" required rows={TEXTAREA_ROWS} />}
      </Field>
      <Field label="Expected">
        {(props) => <Textarea {...props} name="expected" rows={TEXTAREA_ROWS} />}
      </Field>
    </ActionDialog>
  );
}

export function ImportDialog() {
  return (
    <ActionDialog
      trigger={{ children: 'Import CSV / JSONL', icon: 'upload' }}
      title="Import items"
      intent="import"
      submitLabel="Import"
      encType="multipart/form-data"
    >
      <p className="m-0 text-muted">
        CSV needs an <code className="font-mono">input</code> column and may have{' '}
        <code className="font-mono">expected</code>. JSONL lines look like{' '}
        <code className="font-mono">{'{"input": …, "expected": …}'}</code>.
      </p>
      <Field label="File">
        {(props) => (
          <Input
            {...props}
            name="file"
            type="file"
            accept=".csv,.jsonl,.json"
            required
            className="py-1.5"
          />
        )}
      </Field>
    </ActionDialog>
  );
}

export function RunEvalDialog({ versions }: { versions: Array<{ id: string; label: string }> }) {
  return (
    <ActionDialog
      trigger={{ children: 'Run eval', variant: 'primary', disabled: versions.length === 0 }}
      title="Run eval"
      intent="run-eval"
      submitLabel="Start run"
    >
      <Field label="Prompt version">
        {(props) => (
          <Select {...props} name="promptVersionId" required>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label="LLM judge rubric"
        hint="Scored 1–5 by the judge model with calibration examples."
      >
        {(props) => (
          <Textarea {...props} name="rubric" required rows={3} defaultValue={DEFAULT_RUBRIC} />
        )}
      </Field>
      <div className="flex flex-wrap gap-3">
        <Field label="Judge model" className="flex-[1_1_200px]">
          {(props) => (
            <Input
              {...props}
              name="judgeModel"
              required
              defaultValue={DEFAULT_JUDGE_MODEL}
              className="font-mono text-[13px]"
            />
          )}
        </Field>
        <Field label="Cost limit, USD" className="flex-[1_1_120px]">
          {(props) => (
            <Input
              {...props}
              name="costLimit"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={DEFAULT_COST_LIMIT}
            />
          )}
        </Field>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 text-[13px]">
        <legend className="mb-1.5 font-medium">Code checks</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="exactMatch" /> Exact match with expected
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="validJson" /> Output is a JSON object (Zod schema)
        </label>
      </fieldset>
    </ActionDialog>
  );
}

export function NewDatasetFields() {
  return (
    <>
      <Field label="Name" hint="Lowercase letters, numbers and dashes.">
        {(props) => (
          <Input
            {...props}
            name="name"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            placeholder="support-golden"
          />
        )}
      </Field>
      <Field label="Description">
        {(props) => (
          <Input
            {...props}
            name="description"
            maxLength={200}
            placeholder="Curated answers reviewed by support leads"
          />
        )}
      </Field>
    </>
  );
}
