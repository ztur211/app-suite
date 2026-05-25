import { Injectable } from '@nestjs/common';
import type { ShoppingPayload } from '@things/types';

export interface BuyDispatchInput {
  dictationId: string;
  userId: string;
  payload: ShoppingPayload;
}

@Injectable()
export class BuyHandler {
  async dispatch(_i: BuyDispatchInput): Promise<{ destinationRef: string | null }> {
    // Parks in PENDING_BUY — Buy Things will consume later via the pending API.
    return { destinationRef: null };
  }

  async undo(_i: { destinationRef: string | null }): Promise<void> {
    // No-op until Buy Things has stamped a destinationRef.
  }
}
