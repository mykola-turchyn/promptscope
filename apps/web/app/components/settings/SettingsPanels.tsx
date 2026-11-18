import { useState } from 'react';
import { Form, useFetcher } from 'react-router';
import { ActionDialog } from '~/components/ui/ActionDialog';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader } from '~/components/ui/Card';
import { Field, Input, Select } from '~/components/ui/Field';
import { Icon } from '~/components/ui/Icon';
import { Table, TableHead, Td, Th } from '~/components/ui/Table';
import { formatCost, formatDate, formatRelative } from '~/lib/format';

export const CREATE_KEY_FETCHER = 'create-api-key';
const COPIED_MS = 1_500;
const JUST_CREATED_MS = 60_000;

export function CreatedKeyBanner({
  name,
  apiKey,
  onDone,
}: {
  name: string;
  apiKey: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-card border border-warning bg-warning-soft px-[18px] py-4"
    >
      <div className="flex items-start gap-2.5">
        <Icon name="alertTriangle" size={18} className="mt-px flex-none text-warning" />
        <div className="flex flex-col gap-0.5">
          <strong className="font-semibold">Key “{name}” created. Copy it now.</strong>
          <span className="text-muted">
            We store only a hash, so this is the only time the full key is shown.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <code className="flex min-h-9 flex-[1_1_360px] items-center overflow-x-auto rounded-control border border-border bg-surface px-3 font-mono text-[13px] whitespace-nowrap">
          {apiKey}
        </code>
        <Button
          icon="copy"
          onClick={async () => {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_MS);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </section>
  );
}

export function ApiKeysCard({
  keys,
  canEdit,
  now,
  timeZone,
}: {
  keys: Array<{
    id: string;
    name: string;
    prefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
  canEdit: boolean;
  now: Date;
  timeZone: string;
}) {
  const revoke = useFetcher();

  return (
    <Card as="section" aria-labelledby="keys-title" className="flex flex-col">
      <CardHeader
        titleId="keys-title"
        title="API keys"
        description="Used by the SDK to send traces to this project."
        actions={
          canEdit && (
            <ActionDialog
              trigger={{ children: 'Create key', variant: 'primary', icon: 'plus' }}
              title="Create API key"
              intent="create-key"
              submitLabel="Create key"
              fetcherKey={CREATE_KEY_FETCHER}
            >
              <Field
                label="API key name"
                hint="Where the key is used, for example production-backend."
              >
                {(props) => <Input {...props} name="name" required maxLength={60} autoFocus />}
              </Field>
            </ActionDialog>
          )
        }
      />
      <Table minWidth={720} caption="API keys">
        <TableHead>
          <Th>Name</Th>
          <Th>Key</Th>
          <Th>Created</Th>
          <Th>Last used</Th>
          <Th align="right">
            <span className="sr-only">Actions</span>
          </Th>
        </TableHead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <Td className="py-3 font-medium">{key.name}</Td>
              <Td className="py-3 font-mono text-xs text-muted">{key.prefix}</Td>
              <Td className="py-3 whitespace-nowrap text-muted">
                {now.getTime() - key.createdAt.getTime() < JUST_CREATED_MS
                  ? 'Just now'
                  : formatDate(key.createdAt, timeZone)}
              </Td>
              <Td className="py-3 whitespace-nowrap text-muted">
                {formatRelative(key.lastUsedAt, now)}
              </Td>
              <Td align="right" className="py-3">
                {canEdit && (
                  <revoke.Form
                    method="post"
                    onSubmit={(event) => {
                      if (
                        !window.confirm(`Revoke “${key.name}”? Apps using it stop sending traces.`)
                      )
                        event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="keyId" value={key.id} />
                    <Button
                      type="submit"
                      name="intent"
                      value="revoke"
                      variant="dangerText"
                      size="sm"
                      aria-label={`Revoke ${key.name}`}
                    >
                      Revoke
                    </Button>
                  </revoke.Form>
                )}
              </Td>
            </tr>
          ))}
          {keys.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center text-muted">
                No active keys. Create one to start sending traces.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}

export function RetentionCard({
  days,
  options,
  canEdit,
}: {
  days: number;
  options: readonly number[];
  canEdit: boolean;
}) {
  return (
    <Card
      as="section"
      aria-labelledby="retention-title"
      className="flex flex-col gap-3.5 px-[18px] py-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="retention-title" className="m-0 text-base font-semibold">
          Data retention
        </h2>
        <span className="text-[13px] text-muted">
          Spans older than this are deleted nightly, one monthly partition at a time.
        </span>
      </div>
      <Form method="post" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="intent" value="retention" />
        <Field label="Keep traces for" className="flex-[0_1_220px]">
          {(props) => (
            <Select {...props} name="retentionDays" defaultValue={days} disabled={!canEdit}>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option} days
                </option>
              ))}
            </Select>
          )}
        </Field>
        {canEdit && <Button type="submit">Save</Button>}
      </Form>
    </Card>
  );
}

export function GeneralCard({ name, canEdit }: { name: string; canEdit: boolean }) {
  return (
    <Card as="section" className="flex flex-col gap-3.5 px-[18px] py-4">
      <h2 className="m-0 text-base font-semibold">Project</h2>
      <Form method="post" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="intent" value="rename" />
        <Field label="Name" className="flex-[0_1_320px]">
          {(props) => (
            <Input
              {...props}
              name="name"
              defaultValue={name}
              required
              maxLength={60}
              disabled={!canEdit}
            />
          )}
        </Field>
        {canEdit && <Button type="submit">Save</Button>}
      </Form>
    </Card>
  );
}

const ROLE_TONES = { owner: 'accent', admin: 'success', member: 'neutral' } as const;

export function MembersCard({
  members,
}: {
  members: Array<{ id: string; name: string; email: string; role: string }>;
}) {
  return (
    <Card as="section" className="flex flex-col">
      <CardHeader
        title="Members"
        description="People in this organization. Members have read-only access."
      />
      <Table minWidth={560} caption="Members">
        <TableHead>
          <Th>Name</Th>
          <Th>Email</Th>
          <Th align="right">Role</Th>
        </TableHead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <Td className="py-3 font-medium">{member.name}</Td>
              <Td className="py-3 text-muted">{member.email}</Td>
              <Td align="right" className="py-3">
                <Badge tone={ROLE_TONES[member.role as keyof typeof ROLE_TONES] ?? 'neutral'}>
                  {member.role}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

export function PricesCard({
  prices,
  timeZone,
}: {
  prices: Array<{
    id: string;
    provider: string;
    model: string;
    inputPer1m: number;
    outputPer1m: number;
    validFrom: Date;
  }>;
  timeZone: string;
}) {
  return (
    <Card as="section" className="flex flex-col">
      <CardHeader
        title="Model prices"
        description="Per million tokens. The worker prices every span with these."
      />
      <Table minWidth={640} caption="Model prices">
        <TableHead>
          <Th>Model</Th>
          <Th>Provider</Th>
          <Th align="right">Input</Th>
          <Th align="right">Output</Th>
          <Th align="right">Valid from</Th>
        </TableHead>
        <tbody>
          {prices.map((price) => (
            <tr key={price.id}>
              <Td className="py-3 font-mono text-xs">{price.model}</Td>
              <Td className="py-3 text-muted">{price.provider}</Td>
              <Td align="right" className="py-3">
                {formatCost(price.inputPer1m)}
              </Td>
              <Td align="right" className="py-3">
                {formatCost(price.outputPer1m)}
              </Td>
              <Td align="right" className="py-3 text-muted">
                {formatDate(price.validFrom, timeZone)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
