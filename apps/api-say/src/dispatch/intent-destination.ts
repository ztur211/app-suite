import type { Intent } from '@things/types';

/**
 * Destination labels persisted verbatim in `Dictation.destination`. The
 * api-say Postgres migration will switch this column to a native enum.
 */
export type Destination = 'DO_THINGS' | 'SAY_LIBRARY' | 'CLIPBOARD' | 'PENDING_BUY' | 'PENDING_EAT';

export const intentToDestination: Record<Intent, Destination> = {
  DO: 'DO_THINGS',
  NOTE: 'SAY_LIBRARY',
  SEND: 'CLIPBOARD',
  BUY: 'PENDING_BUY',
  EAT: 'PENDING_EAT',
};
