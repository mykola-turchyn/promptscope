export interface MessageBlock {
  role: string;
  text: string;
}

export interface KeyedMessageBlock extends MessageBlock {
  id: number;
}

const LABELS: Record<string, [string, string]> = {
  tool: ['Arguments', 'Result'],
  retrieval: ['Query', 'Documents'],
  http: ['Request', 'Response'],
};
const DEFAULT_LABELS: [string, string] = ['Input', 'Output'];
const JSON_INDENT = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    Array.isArray(value) &&
    value.every((part) => isRecord(part) && typeof part.text === 'string')
  ) {
    return value.map((part) => (isRecord(part) ? String(part.text) : '')).join('');
  }

  return JSON.stringify(value, null, JSON_INDENT);
}

function toolCallText(call: unknown): string {
  if (!isRecord(call)) return asText(call);
  const fn = isRecord(call.function) ? call.function : call;
  const name = typeof fn.name === 'string' ? fn.name : 'tool';
  const args =
    typeof fn.arguments === 'string'
      ? fn.arguments
      : JSON.stringify(fn.arguments ?? {}, null, JSON_INDENT);

  return `${name}(${args})`;
}

function messageBlocks(message: unknown): MessageBlock[] {
  if (!isRecord(message) || typeof message.role !== 'string') return [];
  const role = capitalize(message.role);
  const blocks: MessageBlock[] = [];
  if (message.content !== undefined && message.content !== null && message.content !== '') {
    blocks.push({ role, text: asText(message.content) });
  }
  if (Array.isArray(message.tool_calls)) {
    blocks.push({
      role: `${role} · tool call`,
      text: message.tool_calls.map(toolCallText).join('\n'),
    });
  }

  return blocks;
}

function inputBlocks(input: unknown, label: string): MessageBlock[] {
  if (isRecord(input) && Array.isArray(input.messages)) {
    const system = typeof input.system === 'string' ? [{ role: 'System', text: input.system }] : [];

    return [...system, ...input.messages.flatMap(messageBlocks)];
  }
  if (isRecord(input) && typeof input.query === 'string' && Object.keys(input).length === 1) {
    return [{ role: label, text: input.query }];
  }

  return input === null || input === undefined ? [] : [{ role: label, text: asText(input) }];
}

function outputBlocks(output: unknown, label: string): MessageBlock[] {
  const message = messageBlocks(output);
  if (message.length > 0) return message;

  return output === null || output === undefined ? [] : [{ role: label, text: asText(output) }];
}

export function spanMessages(span: {
  type: string;
  input: unknown;
  output: unknown;
  error: string | null;
}): KeyedMessageBlock[] {
  const [inputLabel, outputLabel] = LABELS[span.type] ?? DEFAULT_LABELS;
  const blocks = [
    ...inputBlocks(span.input, inputLabel),
    ...outputBlocks(span.output, outputLabel),
  ];

  const all = span.error ? [...blocks, { role: 'Error', text: span.error }] : blocks;

  return all.map((block, id) => ({ ...block, id }));
}
