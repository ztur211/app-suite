import { tokens } from '@things/design-system';
import type { Intent } from './types';

/** Human label for each classified intent. */
export const intentLabel: Record<Intent, string> = {
  DO: 'To-do',
  NOTE: 'Note',
  SEND: 'Message',
  BUY: 'Shopping',
  EAT: 'Meal',
};

/** Badge color per intent — reuses the destination app's accent. */
export function intentColor(intent: Intent): string {
  switch (intent) {
    case 'DO':
      return tokens.colors.apps.do;
    case 'SEND':
      return tokens.colors.apps.send;
    case 'BUY':
      return tokens.colors.apps.buy;
    case 'EAT':
      return tokens.colors.apps.eat;
    case 'NOTE':
      return tokens.colors.apps.say;
  }
}
