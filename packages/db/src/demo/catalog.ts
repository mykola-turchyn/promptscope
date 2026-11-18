export const DEMO_ORG = { name: 'Acme AI', slug: 'acme-ai' } as const;
export const DEMO_PROJECT = { name: 'support-bot', slug: 'support-bot' } as const;

export const SUPPORT_QUESTIONS = [
  { tag: 'billing', text: 'I was charged twice for my October invoice. Can you fix it?' },
  { tag: 'billing', text: 'Can I pause my subscription for two months?' },
  { tag: 'onboarding', text: 'How do I change the email on my account?' },
  { tag: 'onboarding', text: 'Do you support SSO with Okta?' },
  { tag: 'shipping', text: 'Where is my order #48213?' },
  { tag: 'shipping', text: 'My parcel says delivered but I have nothing.' },
  { tag: 'privacy', text: 'Is my data used to train your models?' },
  { tag: 'billing', text: 'Cancel my plan and delete everything.' },
] as const;

export const SUPPORT_ANSWERS = [
  'Sorry about that. I can see two charges for the same invoice, so I have started a refund for the duplicate. It takes 5–7 business days.',
  'You can pause for up to three months in Settings → Billing. Billing resumes automatically afterwards.',
  'Go to Settings → Profile, change the email and confirm it from the verification message we send.',
  'Yes, SSO with Okta is available on the Business plan. Here is the setup guide.',
  'Could you share the email used on the order? I will check the latest shipping status for you.',
] as const;

export const KB_DOCUMENTS = [
  'refunds/duplicate-charges.md',
  'billing/payment-methods.md',
  'refunds/timelines.md',
  'account/change-email.md',
  'shipping/tracking.md',
] as const;

export const REFUND_REQUESTS = [
  'I was charged twice for order #58213, please refund one.',
  'Double charge on order 77120, refund please',
  'Refund one of two identical charges, card ending 4421',
  'Refund $640 for a cancelled annual plan',
] as const;

export const TICKET_LABELS = ['billing', 'bug', 'how-to', 'refund', 'shipping'] as const;

export const SUPPORT_SYSTEM_PROMPT =
  'You are a friendly support agent for {{company}}. Answer using only the knowledge base. If unsure, offer a human handoff.';

export const REFUND_TEMPLATES = {
  v5: [
    'You are a support agent for {{company}}.',
    'Use the tools to look up orders and refund charges.',
    '',
    'Customer: {{customer_name}}',
    'Ticket: {{ticket_text}}',
  ],
  v6: [
    'You are a support agent for {{company}}.',
    'Refund only duplicate charges.',
    '',
    'Customer: {{customer_name}}',
    'Ticket: {{ticket_text}}',
  ],
  v7: [
    'You are a support agent for {{company}}.',
    'Refund only duplicate charges.',
    'Always confirm the amount before calling issue_refund.',
    'If a tool fails, apologise and hand the ticket to a human.',
    '',
    'Customer: {{customer_name}}',
    'Ticket: {{ticket_text}}',
  ],
  v8: [
    'You are a support agent for {{company}}.',
    'Refund only duplicate charges.',
    'Before calling issue_refund, confirm the charge ID and amount',
    'with get_order. Never refund more than {{max_refund}}.',
    'If a tool fails, apologise and hand the ticket to a human.',
    '',
    'Customer: {{customer_name}}',
    'Ticket: {{ticket_text}}',
  ],
} as const;

export const REFUND_VERSION_NOTES = {
  v5: 'First version with tools',
  v6: 'Shorter system prompt',
  v7: 'Hand off to a human on tool failure',
  v8: 'Tighter refund guardrails',
} as const;

export const SUPPORT_REPLY_NOTES = [
  'Initial version',
  'Add knowledge base context',
  'Friendlier tone',
  'Mention human handoff',
  'Shorter answers',
  'Cite the source document',
  'Handle angry customers',
  'Ask for order ID before shipping questions',
  'Never guess shipping status',
  'Add pause subscription policy',
  'Clarify refund timelines',
  'Support SSO questions',
] as const;

export const DATASETS = [
  {
    name: 'support-golden',
    description: 'Curated answers reviewed by support leads',
    size: 120,
    items: [
      [
        'I was charged twice for my October invoice. Can you fix it?',
        'Apologise, confirm the duplicate charge, start a refund, give 5–7 day timeline',
        'trace',
      ],
      [
        'How do I change the email on my account?',
        'Steps via Settings → Profile, mention verification email',
        'manual',
      ],
      [
        'Your app deleted my project, I want my money back NOW',
        'De-escalate, check restore options before refund, offer human handoff',
        'trace',
      ],
      ['Do you support SSO with Okta?', 'Yes on Business plan, link to SSO setup guide', 'import'],
      [
        'Can I pause my subscription for two months?',
        'Explain pause option, max 3 months, billing resumes automatically',
        'import',
      ],
      [
        'Where is my order #48213?',
        'Ask for email on the order, never guess shipping status',
        'trace',
      ],
      ['Is my data used to train your models?', 'No; link to privacy policy section 4', 'manual'],
      [
        'Cancel my plan and delete everything.',
        'Confirm intent, explain data deletion window, require account owner',
        'import',
      ],
    ],
  },
  {
    name: 'refund-edge-cases',
    description: 'Partial refunds, chargebacks, duplicates',
    size: 48,
    items: [
      ['Charged twice for order #58213', 'get_order → issue_refund(ch_A2, 49.00)', 'trace'],
      ['Refund $640 for a cancelled annual plan', 'handoff_to_human(reason: over_limit)', 'manual'],
      ['Where is my parcel? Ordered last Monday', 'Reply with tracking link', 'trace'],
      [
        'Refund one of two identical charges, card ending 4421',
        'get_order → issue_refund(ch_P3, 19.99)',
        'trace',
      ],
      ['I want a refund, the app is slow', 'Reply: troubleshooting tips, no refund', 'manual'],
      [
        'Double charge on order 77120, refund please',
        'get_order → issue_refund(ch_M1, 49.00)',
        'trace',
      ],
      [
        'Payment failed but money left my account',
        'get_order → explain pending authorisation',
        'import',
      ],
      ['Can I get a partial refund for a late delivery?', 'Offer 10% credit', 'import'],
    ],
  },
  {
    name: 'classify-regression',
    description: 'Ticket triage labels from production',
    size: 300,
    items: [
      ['My invoice shows the wrong VAT number', 'billing', 'trace'],
      ['The export button does nothing', 'bug', 'trace'],
      ['How do I invite a teammate?', 'how-to', 'trace'],
    ],
  },
  {
    name: 'tone-checks',
    description: 'Angry customers, escalation wording',
    size: 36,
    items: [
      [
        'This is the third time I am asking. Fix it.',
        'Apologise once, give a concrete next step',
        'manual',
      ],
      ['Your support is useless', 'Stay calm, offer a human handoff', 'manual'],
    ],
  },
] as const;

export const EVAL_ITEMS = [
  ['issue_refund(ch_A2, 49.00)', 'get_order → issue_refund(ch_A2, 49.00)', 4, 5],
  ['issue_refund(ch_K9, 640.00)', 'handoff_to_human(reason: over_limit)', 2, 5],
  ['Reply: tracking link sent', 'Reply: tracking link sent', 5, 5],
  ['issue_refund(ch_P3, 19.99)', 'get_order → issue_refund(ch_P3, 19.99)', 4, 5],
  ['Reply: apology + troubleshooting tips', 'Reply: refund policy, asks for order ID', 5, 3],
  ['issue_refund(amount: "49")', 'get_order → issue_refund(ch_M1, 49.00)', 2, 5],
  ['Reply: wait 3–5 days', 'get_order → Reply: pending authorisation', 3, 4],
  ['Reply: offers 10% credit', 'Reply: hands off to human', 4, 3],
] as const;
