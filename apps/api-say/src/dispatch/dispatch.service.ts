import { Injectable } from '@nestjs/common';
import type {
  Intent,
  TaskPayload,
  NotePayload,
  EmailPayload,
  ShoppingPayload,
  MealPayload,
} from '@things/types';
import { DoHandler } from './handlers/do.handler';
import { NoteHandler } from './handlers/note.handler';
import { SendHandler } from './handlers/send.handler';
import { BuyHandler } from './handlers/buy.handler';
import { EatHandler } from './handlers/eat.handler';

export interface DispatchInput {
  intent: Intent;
  dictationId: string;
  userId: string;
  payload: TaskPayload | NotePayload | EmailPayload | ShoppingPayload | MealPayload;
}

export interface DispatchOutput {
  destinationRef: string | null;
  renderedEmail?: string;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly doH: DoHandler,
    private readonly noteH: NoteHandler,
    private readonly sendH: SendHandler,
    private readonly buyH: BuyHandler,
    private readonly eatH: EatHandler,
  ) {}

  async dispatch(i: DispatchInput): Promise<DispatchOutput> {
    const base = { dictationId: i.dictationId, userId: i.userId };
    switch (i.intent) {
      case 'DO':
        return this.doH.dispatch({ ...base, payload: i.payload as TaskPayload });
      case 'NOTE':
        return this.noteH.dispatch({ ...base, payload: i.payload as NotePayload });
      case 'SEND':
        return this.sendH.dispatch({ ...base, payload: i.payload as EmailPayload });
      case 'BUY':
        return this.buyH.dispatch({ ...base, payload: i.payload as ShoppingPayload });
      case 'EAT':
        return this.eatH.dispatch({ ...base, payload: i.payload as MealPayload });
    }
  }

  async undo(i: { intent: Intent; userId: string; destinationRef: string | null }): Promise<void> {
    if (!i.destinationRef) return;
    switch (i.intent) {
      case 'DO':
        return this.doH.undo({ userId: i.userId, destinationRef: i.destinationRef });
      case 'NOTE':
        return this.noteH.undo({ destinationRef: i.destinationRef });
      case 'SEND':
        return this.sendH.undo({ destinationRef: i.destinationRef });
      case 'BUY':
        return this.buyH.undo({ destinationRef: i.destinationRef });
      case 'EAT':
        return this.eatH.undo({ destinationRef: i.destinationRef });
    }
  }
}
