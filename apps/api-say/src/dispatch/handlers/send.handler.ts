import { Injectable } from '@nestjs/common';
import type { EmailPayload } from '@things/types';

export interface SendDispatchInput {
  dictationId: string;
  userId: string;
  payload: EmailPayload;
}

export interface SendDispatchOutput {
  destinationRef: string | null;
  renderedEmail: string;
}

@Injectable()
export class SendHandler {
  async dispatch(i: SendDispatchInput): Promise<SendDispatchOutput> {
    const recipientLine = i.payload.recipientHint ? `(To: ${i.payload.recipientHint})\n\n` : '';
    const renderedEmail =
      `Subject: ${i.payload.subject}\n\n${i.payload.body}\n\n${recipientLine}`.trimEnd();
    return { destinationRef: null, renderedEmail };
  }

  async undo(_i: { destinationRef: string | null }): Promise<void> {
    // Rendered email was returned for the user to copy/paste — cannot un-copy.
  }
}
