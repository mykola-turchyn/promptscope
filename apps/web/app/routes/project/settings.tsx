import { useState } from 'react';
import { data, useFetcher } from 'react-router';
import { z } from 'zod';
import { projectContext, requireEditor, sessionContext } from '~/.server/context';
import {
  createApiKey,
  listApiKeys,
  listMembers,
  listModelPrices,
  RETENTION_OPTIONS,
  revokeApiKey,
  updateProject,
} from '~/.server/queries/settings';
import { PageBody } from '~/components/layout/AppShell';
import {
  ApiKeysCard,
  CREATE_KEY_FETCHER,
  CreatedKeyBanner,
  GeneralCard,
  MembersCard,
  PricesCard,
  RetentionCard,
} from '~/components/settings/SettingsPanels';
import { PageHeading } from '~/components/ui/Misc';
import { Tabs } from '~/components/ui/Tabs';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import { useTimeZone } from '~/lib/time-zone';
import type { Route } from './+types/settings';

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const TABS = [
  { id: 'general', label: 'General' },
  { id: 'keys', label: 'API keys' },
  { id: 'members', label: 'Members' },
  { id: 'prices', label: 'Model prices' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function isTab(value: string | undefined): value is TabId {
  return TABS.some(({ id }) => id === value);
}

export const handle = defineHandle<{ tabLabel: string }>({
  breadcrumb: (loaderData) => loaderData.tabLabel,
});

export const meta: Route.MetaFunction = () => [{ title: 'Settings · Promptscope' }];

export async function loader({ context, params }: Route.LoaderArgs) {
  if (!isTab(params.tab)) throw data('Settings page not found', { status: HTTP_NOT_FOUND });
  const { org, project, canEdit } = context.get(projectContext);
  const tab = params.tab;
  const [keys, members, prices] = await Promise.all([
    tab === 'keys' ? listApiKeys(project.id) : [],
    tab === 'members' ? listMembers(org.id) : [],
    tab === 'prices' ? listModelPrices() : [],
  ]);

  return {
    tab,
    tabLabel: TABS.find(({ id }) => id === tab)?.label ?? '',
    org: { name: org.name },
    project: { name: project.name, slug: project.slug, retentionDays: project.retentionDays },
    keys,
    members,
    prices,
    canEdit,
    retentionOptions: RETENTION_OPTIONS,
    now: new Date(),
  };
}

const actionSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('create-key'), name: z.string().trim().min(1).max(60) }),
  z.object({ intent: z.literal('revoke'), keyId: z.uuid() }),
  z.object({
    intent: z.literal('retention'),
    retentionDays: z.coerce
      .number()
      .refine((days) => (RETENTION_OPTIONS as readonly number[]).includes(days)),
  }),
  z.object({ intent: z.literal('rename'), name: z.string().trim().min(1).max(60) }),
]);

export async function action({ request, context }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const { user } = context.get(sessionContext);
  const parsed = actionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success)
    return data({ error: 'Check the form and try again.' }, { status: HTTP_BAD_REQUEST });
  const input = parsed.data;

  switch (input.intent) {
    case 'create-key':
      return {
        ok: true,
        created: { name: input.name, key: await createApiKey(project.id, input.name, user.id) },
      };
    case 'revoke':
      if (!(await revokeApiKey(project.id, input.keyId))) {
        return data({ error: 'Key not found' }, { status: HTTP_NOT_FOUND });
      }

      return { ok: true };
    case 'retention':
      await updateProject(project.id, { retentionDays: input.retentionDays });

      return { ok: true };
    case 'rename':
      await updateProject(project.id, { name: input.name });

      return { ok: true };
  }
}

export default function Settings({ loaderData, params }: Route.ComponentProps) {
  const timeZone = useTimeZone();
  const created = useFetcher<{ created?: { name: string; key: string } }>({
    key: CREATE_KEY_FETCHER,
  });
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const createdKey = created.data?.created;
  const { tab, project, canEdit } = loaderData;

  return (
    <PageBody maxWidth={1040}>
      <PageHeading
        title="Settings"
        description={
          <>
            Project <span className="font-mono">{project.slug}</span> in {loaderData.org.name}
          </>
        }
      />
      <Tabs
        label="Settings sections"
        size="md"
        selected={tab}
        items={TABS.map(({ id, label }) => ({
          id,
          label,
          to: projectPath(params, `settings/${id}`),
        }))}
        className="px-0 pt-0"
      />
      {tab === 'keys' && (
        <>
          {createdKey && createdKey.key !== dismissedKey && (
            <CreatedKeyBanner
              name={createdKey.name}
              apiKey={createdKey.key}
              onDone={() => setDismissedKey(createdKey.key)}
            />
          )}
          <ApiKeysCard
            keys={loaderData.keys}
            canEdit={canEdit}
            now={loaderData.now}
            timeZone={timeZone}
          />
          <RetentionCard
            days={project.retentionDays}
            options={loaderData.retentionOptions}
            canEdit={canEdit}
          />
        </>
      )}
      {tab === 'general' && <GeneralCard name={project.name} canEdit={canEdit} />}
      {tab === 'members' && <MembersCard members={loaderData.members} />}
      {tab === 'prices' && <PricesCard prices={loaderData.prices} timeZone={timeZone} />}
    </PageBody>
  );
}
