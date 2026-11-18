import { Form, useNavigation } from 'react-router';
import { Button, ButtonLink } from '~/components/ui/Button';
import { Field, Input, Select, Textarea } from '~/components/ui/Field';

export const TEMPLATE_MAX_LENGTH = 20_000;
const TEMPLATE_ROWS = 12;

export function TemplateForm({
  intent,
  defaults,
  withName,
  cancelTo,
  error,
  baseVersionId,
}: {
  intent: string;
  baseVersionId?: string;
  defaults: { template: string; model: string };
  withName?: boolean;
  cancelTo: string;
  error?: string;
}) {
  const navigation = useNavigation();

  return (
    <Form method="post" className="flex flex-col gap-4 p-4">
      <input type="hidden" name="intent" value={intent} />
      {baseVersionId && <input type="hidden" name="baseVersionId" value={baseVersionId} />}
      {withName && (
        <Field
          label="Name"
          hint="Lowercase letters, numbers and dashes. The SDK fetches the prompt by this name."
        >
          {(props) => (
            <Input
              {...props}
              name="name"
              required
              pattern="[a-z0-9][a-z0-9-]*"
              placeholder="support-reply"
            />
          )}
        </Field>
      )}
      <Field label="Template" hint="Use {{variable}} for values filled in at runtime.">
        {(props) => (
          <Textarea
            {...props}
            name="template"
            required
            rows={TEMPLATE_ROWS}
            maxLength={TEMPLATE_MAX_LENGTH}
            defaultValue={defaults.template}
            spellCheck={false}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-3">
        <Field label="Model" className="flex-[1_1_200px]">
          {(props) => (
            <Input
              {...props}
              name="model"
              required
              defaultValue={defaults.model}
              className="font-mono text-[13px]"
            />
          )}
        </Field>
        <Field label="Label" className="flex-[1_1_160px]">
          {(props) => (
            <Select {...props} name="label" defaultValue="staging">
              <option value="">None</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="What changed">
        {(props) => (
          <Input {...props} name="note" maxLength={120} placeholder="Tighter refund guardrails" />
        )}
      </Field>
      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <ButtonLink to={cancelTo} preventScrollReset>
          Cancel
        </ButtonLink>
        <Button type="submit" variant="primary" disabled={navigation.state !== 'idle'}>
          Save version
        </Button>
      </div>
    </Form>
  );
}
