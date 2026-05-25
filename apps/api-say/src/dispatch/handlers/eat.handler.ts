import { Injectable } from '@nestjs/common';
import type { MealPayload } from '@things/types';

export interface EatDispatchInput {
  dictationId: string;
  userId: string;
  payload: MealPayload;
}

@Injectable()
export class EatHandler {
  async dispatch(_i: EatDispatchInput): Promise<{ destinationRef: string | null }> {
    // Parks in PENDING_EAT — Eat Things will consume later.
    return { destinationRef: null };
  }

  async undo(_i: { destinationRef: string | null }): Promise<void> {
    // No-op until Eat Things has stamped a destinationRef.
  }
}
