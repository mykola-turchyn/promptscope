import { describe, expect, it } from 'vitest';
import { extractVariables, renderTemplate } from './templates.ts';

describe('extractVariables', () => {
  it('finds unique variable names in order', () => {
    const template = 'Hi {{customer_name}}, about {{ ticket_text }} and {{customer_name}}';

    expect(extractVariables(template)).toEqual(['customer_name', 'ticket_text']);
  });
});

describe('renderTemplate', () => {
  it('substitutes known variables and keeps unknown placeholders', () => {
    const rendered = renderTemplate('Max {{max_refund}} for {{company}}', { max_refund: 50 });

    expect(rendered).toBe('Max 50 for {{company}}');
  });
});
