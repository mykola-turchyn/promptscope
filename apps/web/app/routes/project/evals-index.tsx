import { redirect } from 'react-router';
import { projectContext } from '~/.server/context';
import { latestRuns } from '~/.server/queries/evals';
import { PageBody } from '~/components/layout/AppShell';
import { ButtonLink } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { PageHeading } from '~/components/ui/Misc';
import { projectPath } from '~/lib/paths';
import { defineHandle } from '~/lib/route-handle';
import type { Route } from './+types/evals-index';

const RECENT_RUNS = 20;

export const handle = defineHandle({ breadcrumb: 'Evals' });

export const meta: Route.MetaFunction = () => [{ title: 'Evals · Promptscope' }];

export async function loader({ context, params }: Route.LoaderArgs) {
  const { project } = context.get(projectContext);
  const runs = await latestRuns(project.id, RECENT_RUNS);
  const [latest] = runs;
  const baseline = runs.find(
    (run) =>
      latest &&
      run.datasetId === latest.datasetId &&
      run.promptVersionId !== latest.promptVersionId,
  );
  if (latest) {
    throw redirect(
      projectPath(params, `evals/compare?a=${(baseline ?? latest).id}&b=${latest.id}`),
    );
  }

  return null;
}

export default function EvalsEmpty() {
  return (
    <PageBody maxWidth={880}>
      <PageHeading title="Evals" description="Compare two prompt versions on the same dataset." />
      <Card className="flex flex-col items-start gap-3 p-[18px]">
        <strong className="font-semibold">No eval runs yet</strong>
        <span className="text-muted">
          Pick a dataset and a prompt version to run the first eval. Runs on the same dataset can
          then be compared side by side.
        </span>
        <ButtonLink to="../datasets" relative="path" variant="primary">
          Go to datasets
        </ButtonLink>
      </Card>
    </PageBody>
  );
}
