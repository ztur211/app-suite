import { z } from 'zod';

export const taskPayload = z.object({
  title: z.string().min(1).max(500),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().optional(),
});

export const notePayload = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1),
});

export const emailPayload = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  recipientHint: z.string().nullable(),
});

export const shoppingPayload = z.object({
  item: z.string().min(1).max(200),
  quantity: z.number().int().positive().nullable(),
  notes: z.string().optional(),
});

export const mealPayload = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['recipe', 'restaurant', 'either']),
  notes: z.string().optional(),
});

export const intentResult = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('DO'),
    payload: taskPayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('NOTE'),
    payload: notePayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('SEND'),
    payload: emailPayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('BUY'),
    payload: shoppingPayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('EAT'),
    payload: mealPayload,
    confidence: z.number().min(0).max(1),
  }),
]);

export type TaskPayload = z.infer<typeof taskPayload>;
export type NotePayload = z.infer<typeof notePayload>;
export type EmailPayload = z.infer<typeof emailPayload>;
export type ShoppingPayload = z.infer<typeof shoppingPayload>;
export type MealPayload = z.infer<typeof mealPayload>;
export type IntentResult = z.infer<typeof intentResult>;
export type Intent = IntentResult['intent'];
