import { PROMPT_LABELS } from '@promptscope/shared/prompts';
import { z } from 'zod';
import { TEMPLATE_MAX_LENGTH } from '~/components/prompts/TemplateForm';

const MAX_NAME_LENGTH = 64;
const MAX_NOTE_LENGTH = 120;

export const versionFormSchema = z.object({
  template: z.string().trim().min(1, 'The template is empty.').max(TEMPLATE_MAX_LENGTH),
  model: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  note: z.string().trim().max(MAX_NOTE_LENGTH).default(''),
  label: z
    .enum(PROMPT_LABELS)
    .or(z.literal(''))
    .transform((value) => value || null),
});

export const promptNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes.')
  .max(MAX_NAME_LENGTH);
