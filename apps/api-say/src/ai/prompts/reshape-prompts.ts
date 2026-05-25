import type { Intent } from '@things/types';

export const RESHAPE_PROMPT_BY_INTENT: Record<Intent, string> = {
  DO: `Reshape this transcript into a task payload {title, dueAt, notes}.
Resolve relative dates against the user's timezone and local time provided in the message.
Title should be concise and action-oriented. Notes are optional supplemental info.`,
  NOTE: `Reshape this transcript into a note payload {title?, body}.
Title is optional — a short summary. Body is the full content.`,
  SEND: `Reshape this transcript into an email draft {subject, body, recipientHint}.
Subject is concise. Body is professional but matches the tone of the dictation. recipientHint is
the user's stated addressee if any (name, role, "the team"), or null.`,
  BUY: `Reshape this transcript into a shopping item {item, quantity?, notes?}.
Item is the thing to buy. quantity is a positive integer if stated, else null.`,
  EAT: `Reshape this transcript into a food intent {name, kind, notes?}.
name is what the user wants to eat/cook/visit. kind is "recipe" (cooking), "restaurant" (eating out),
or "either" if unclear.`,
};
