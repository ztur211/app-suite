import {
  taskPayload,
  notePayload,
  emailPayload,
  shoppingPayload,
  mealPayload,
  intentResult,
} from '../../say-things/payloads';

describe('say-things payloads', () => {
  it('taskPayload accepts valid input', () => {
    expect(taskPayload.parse({ title: 'X', dueAt: null })).toEqual({ title: 'X', dueAt: null });
    expect(
      taskPayload.parse({ title: 'X', dueAt: '2026-05-23T17:00:00+12:00', notes: 'n' }),
    ).toBeDefined();
  });

  it('taskPayload rejects empty title', () => {
    expect(() => taskPayload.parse({ title: '', dueAt: null })).toThrow();
  });

  it('notePayload requires non-empty body', () => {
    expect(notePayload.parse({ body: 'hello' })).toEqual({ body: 'hello' });
    expect(() => notePayload.parse({ body: '' })).toThrow();
  });

  it('emailPayload requires subject + body + nullable recipientHint', () => {
    expect(emailPayload.parse({ subject: 'S', body: 'B', recipientHint: null })).toBeDefined();
    expect(emailPayload.parse({ subject: 'S', body: 'B', recipientHint: 'Sarah' })).toBeDefined();
    expect(() => emailPayload.parse({ subject: '', body: 'B', recipientHint: null })).toThrow();
  });

  it('shoppingPayload allows nullable quantity', () => {
    expect(shoppingPayload.parse({ item: 'oat milk', quantity: null })).toBeDefined();
    expect(shoppingPayload.parse({ item: 'oat milk', quantity: 2 })).toBeDefined();
    expect(() => shoppingPayload.parse({ item: 'oat milk', quantity: -1 })).toThrow();
  });

  it('mealPayload constrains kind to enum', () => {
    expect(mealPayload.parse({ name: 'sourdough', kind: 'recipe' })).toBeDefined();
    expect(() => mealPayload.parse({ name: 'sourdough', kind: 'pizza' })).toThrow();
  });

  it('intentResult parses each variant', () => {
    expect(
      intentResult.parse({ intent: 'DO', payload: { title: 'X', dueAt: null }, confidence: 0.9 }),
    ).toBeDefined();
    expect(
      intentResult.parse({ intent: 'NOTE', payload: { body: 'b' }, confidence: 0.9 }),
    ).toBeDefined();
    expect(
      intentResult.parse({
        intent: 'EAT',
        payload: { name: 'x', kind: 'either' },
        confidence: 0.9,
      }),
    ).toBeDefined();
  });

  it('intentResult rejects mismatched payload/intent combos', () => {
    expect(() =>
      intentResult.parse({ intent: 'DO', payload: { body: 'b' }, confidence: 0.9 }),
    ).toThrow();
  });
});
