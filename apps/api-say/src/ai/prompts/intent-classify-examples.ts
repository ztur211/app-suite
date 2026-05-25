export interface ClassifyExample {
  transcript: string;
  intent: 'DO' | 'NOTE' | 'SEND' | 'BUY' | 'EAT';
  payload: Record<string, unknown>;
  confidence: number;
}

export const INTENT_CLASSIFY_EXAMPLES: ClassifyExample[] = [
  {
    transcript: 'remind me to email Jamie about Q3 by Thursday',
    intent: 'DO',
    confidence: 0.94,
    payload: { title: 'Email Jamie about Q3', dueAt: '__RELATIVE_THURSDAY__' },
  },
  {
    transcript: 'make a note that the door code is 4471',
    intent: 'NOTE',
    confidence: 0.95,
    payload: { body: 'door code is 4471' },
  },
  {
    transcript: 'draft an email to Sarah saying I will be late',
    intent: 'SEND',
    confidence: 0.92,
    payload: {
      subject: 'Running late',
      body: 'Hi Sarah, I will be late. Apologies for the inconvenience.',
      recipientHint: 'Sarah',
    },
  },
  {
    transcript: 'pick up oat milk and lightbulbs',
    intent: 'BUY',
    confidence: 0.88,
    payload: { item: 'oat milk and lightbulbs', quantity: null },
  },
  {
    transcript: 'want to try making sourdough this weekend',
    intent: 'EAT',
    confidence: 0.86,
    payload: { name: 'sourdough', kind: 'recipe' },
  },
  {
    transcript: 'want to check out that ramen place on Cuba Street',
    intent: 'EAT',
    confidence: 0.87,
    payload: { name: 'ramen place on Cuba Street', kind: 'restaurant' },
  },
  {
    transcript: 'umm',
    intent: 'NOTE',
    confidence: 0.1,
    payload: { body: 'umm' },
  },
  {
    transcript: 'add to shopping list: bin liners three pack',
    intent: 'BUY',
    confidence: 0.93,
    payload: { item: 'bin liners three pack', quantity: 3 },
  },
];
