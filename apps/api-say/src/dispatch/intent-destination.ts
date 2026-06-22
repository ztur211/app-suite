import type { Intent } from '@things/types';

/**
 * Destination labels for dispatch routing. `Dictation.destination` persists these
 * as a native Postgres enum (see prisma/schema.prisma); this union mirrors it.
 */
export type Destination =
  | 'DO_THINGS'
  | 'SAY_LIBRARY'
  | 'CLIPBOARD'
  | 'PENDING_BUY'
  | 'PENDING_EAT'
  | 'PENDING_SEND';

export const intentToDestination: Record<Intent, Destination> = {
  DO: 'DO_THINGS',
  NOTE: 'SAY_LIBRARY',
  SEND: 'PENDING_SEND',
  BUY: 'PENDING_BUY',
  EAT: 'PENDING_EAT',
};
