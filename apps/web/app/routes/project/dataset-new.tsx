import { data, Form, redirect, useNavigation } from 'react-router';
import { z } from 'zod';
import { projectContext, requireEditor } from '~/.server/context';
import { createDataset } from '~/.server/queries/datasets';
import { NewDatasetFields } from '~/components/datasets/DatasetDialogs';
import { PageBody } from '~/components/layout/AppShell';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { PageHeading } from '~/components/ui/Misc';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import type { Route } from './+types/dataset-new';

const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 200;

export const handle = defineHandle({ breadcrumb: 'New dataset' });

export const meta: Route.MetaFunction = () => [{ title: 'New dataset · Promptscope' }];

export function loader({ context }: Route.LoaderArgs) {
  return { canEdit: context.get(projectContext).canEdit };
}

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes.')
    .max(MAX_NAME_LENGTH),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).default(''),
});

export async function action({ request, context, params }: Route.ActionArgs) {
  const { project } = requireEditor(context);
  const parsed = formSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return data(
      { error: parsed.error.issues[0]?.message ?? 'Check the form' },
      { status: HTTP_BAD_REQUEST },
    );
  }
  const dataset = await createDataset(project.id, parsed.data.name, parsed.data.description);
  if (!dataset)
    return data(
      { error: `A dataset named ${parsed.data.name} already exists.` },
      { status: HTTP_CONFLICT },
    );

  throw redirect(projectPath(params, `datasets/${dataset.id}`));
}

export default function NewDataset({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();

  return (
    <PageBody maxWidth={880}>
      <PageHeading
        title="New dataset"
        description="Inputs with expected outputs. Evals run a prompt version against a dataset."
      />
      {loaderData.canEdit ? (
        <Card>
          <Form method="post" className="flex flex-col gap-4 p-[18px]">
            <NewDatasetFields />
            {actionData?.error && (
              <p role="alert" className="m-0 text-danger">
                {actionData.error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="self-end"
              disabled={navigation.state !== 'idle'}
            >
              Create dataset
            </Button>
          </Form>
        </Card>
      ) : (
        <Card className="p-[18px] text-muted">This project has no datasets yet.</Card>
      )}
    </PageBody>
  );
}
