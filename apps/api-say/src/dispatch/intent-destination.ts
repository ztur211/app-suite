import type { Intent } from '@things/types';

/**
 * String-typed destination labels (SQLite has no enum). Values are persisted
 * verbatim in `Dictation.destination`.
 */
export type Destination = 'DO_THINGS' | 'SAY_LIBRARY' | 'CLIPBOARD' | 'PENDING_BUY' | 'PENDING_EAT';

export const intentToDestination: Record<Intent, Destination> = {
  DO: 'DO_THINGS',
  NOTE: 'SAY_LIBRARY',
  SEND: 'CLIPBOARD',
  BUY: 'PENDING_BUY',
  EAT: 'PENDING_EAT',
};
