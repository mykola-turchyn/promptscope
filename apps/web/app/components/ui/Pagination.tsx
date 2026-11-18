import { ButtonLink } from './Button';

export function Pagination({
  summary,
  previous,
  next,
}: {
  summary: string;
  previous: string | null;
  next: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3 text-[13px] text-muted">
      <span>{summary}</span>
      <div className="flex gap-2">
        <ButtonLink to={previous ?? '.'} disabled={!previous} preventScrollReset>
          Previous
        </ButtonLink>
        <ButtonLink to={next ?? '.'} disabled={!next} preventScrollReset>
          Next
        </ButtonLink>
      </div>
    </div>
  );
}
