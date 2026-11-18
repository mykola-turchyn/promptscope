export function projectPath(params: { org?: string; project?: string }, path = ''): string {
  const base = `/${params.org ?? ''}/${params.project ?? ''}`;

  return path ? `${base}/${path.replace(/^\//, '')}` : base;
}
