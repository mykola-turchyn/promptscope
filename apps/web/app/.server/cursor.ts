import { z } from 'zod';

export interface Cursor {
  value: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

const cursorSchema = z.object({ value: z.string(), id: z.string() });

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString()));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
