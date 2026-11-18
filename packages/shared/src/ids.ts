const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_RANDOM_LENGTH = 20;

export const ID_PREFIX = {
  trace: 'tr_',
  span: 'sp_',
  score: 'sc_',
} as const;

export type IdKind = keyof typeof ID_PREFIX;

export function randomString(length: number, alphabet = ID_ALPHABET): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }

  return result;
}

export function newId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}${randomString(ID_RANDOM_LENGTH)}`;
}
