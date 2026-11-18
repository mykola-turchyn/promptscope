import { providerForModel } from '@promptscope/shared/providers';
import { data, redirect } from 'react-router';
import { requireEditor, sessionContext } from '~/.server/context';
import { promptNameSchema, versionFormSchema } from '~/.server/prompt-form';
import { createPrompt, createPromptVersion, listPrompts } from '~/.server/queries/prompts';
import { PageBody } from '~/components/layout/AppShell';
import { PromptNav } from '~/components/prompts/PromptParts';
import { TemplateForm } from '~/components/prompts/TemplateForm';
import { Card } from '~/components/ui/Card';
import { PageHeading } from '~/components/ui/Misc';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import type { Route } from './+types/prompt-new';

const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const DEFAULT_MODEL = 'gpt-4.1-mini';

export const handle = defineHandle({ breadcrumb: 'New prompt' });

export const meta: Route.MetaFunction = () => [{ title: 'New prompt · Promptscope' }];

export async function loader({ context }: Route.LoaderArgs) {
  const { project } = requireEditor(context);

  return { prompts: await listPrompts(project.id) };
}

const formSchema = versionFormSchema.extend({ name: promptNameSchema });

export async function action({ request, context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const { user } = context.get(sessionContext);
  const parsed = formSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return data(
      { error: parsed.error.issues[0]?.message ?? 'Check the form' },
      { status: HTTP_BAD_REQUEST },
    );
  }
  const { name, template, model, note, label } = parsed.data;
  const prompt = await createPrompt(project.id, name);
  if (!prompt)
    return data({ error: `A prompt named ${name} already exists.` }, { status: HTTP_CONFLICT });
  await createPromptVersion({
    promptId: prompt.id,
    template,
    note: note || 'Initial version',
    label,
    userId: user.id,
    modelConfig: { model, provider: providerForModel(model) },
  });

  throw redirect(projectPath(params, `prompts/${name}`));
}

export default function NewPrompt({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <PageBody maxWidth={1320} className="flex-row flex-wrap items-start">
      <PromptNav prompts={loaderData.prompts} current={null} canEdit />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <PageHeading
          title="New prompt"
          description="Each save creates an immutable version the SDK can fetch by label."
        />
        <Card>
          <TemplateForm
            intent="create"
            withName
            defaults={{ template: '', model: DEFAULT_MODEL }}
            cancelTo=".."
            error={actionData?.error}
          />
        </Card>
      </div>
    </PageBody>
  );
}
