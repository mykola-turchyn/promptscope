export const PROMPT_LABELS = ['production', 'staging'] as const;
export type PromptLabel = (typeof PROMPT_LABELS)[number];
