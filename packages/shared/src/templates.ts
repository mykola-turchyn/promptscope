const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g;

export function extractVariables(template: string): string[] {
  const names = [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1] ?? '');

  return [...new Set(names.filter(Boolean))];
}

export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(VARIABLE_PATTERN, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined || value === null) return placeholder;

    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}
