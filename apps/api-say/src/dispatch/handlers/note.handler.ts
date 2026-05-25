import { Injectable } from '@nestjs/common';
import type { NotePayload } from '@things/types';

export interface NoteDispatchInput {
  dictationId: string;
  userId: string;
  payload: NotePayload;
}

@Injectable()
export class NoteHandler {
  async dispatch(_i: NoteDispatchInput): Promise<{ destinationRef: string | null }> {
    return { destinationRef: null };
  }

  async undo(_i: { destinationRef: string | null }): Promise<void> {
    // Notes live in api-say's library — undo is a no-op (caller flips state in DB).
  }
}
