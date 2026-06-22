import { Injectable } from '@nestjs/common';
import { SaySdk } from '@things/say-sdk';
import type { EmailPayload } from '@things/types';
import { PrismaService } from '../prisma/prisma.service';

export interface SyncResult {
  /** New email-draft Messages inserted this run. */
  created: number;
  /** Pending dictations consumed in Say this run. */
  consumed: number;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saySdk: SaySdk,
  ) {}

  /**
   * Pull all PENDING_SEND dictations from api-say for the user, idempotently
   * insert each as an email draft (keyed by sourceDictationId), and mark it
   * consumed in Say with the new Message id.
   */
  async sync(userId: string): Promise<SyncResult> {
    const pending = await this.saySdk.pending.list({ userId, destination: 'PENDING_SEND' });

    let created = 0;
    let consumed = 0;

    for (const p of pending) {
      const existing = await this.prisma.message.findFirst({
        where: { userId, sourceDictationId: p.dictationId },
      });

      let message = existing;
      if (!message) {
        const payload = p.payload as EmailPayload;
        message = await this.prisma.message.create({
          data: {
            userId,
            channel: 'email',
            kind: 'outbound',
            status: 'draft',
            subject: payload.subject,
            body: payload.body,
            recipient: payload.recipientHint ?? null,
            sourceDictationId: p.dictationId,
          },
        });
        created++;
      }

      await this.saySdk.pending.consume(p.dictationId, { userId, destinationRef: message.id });
      consumed++;
    }

    return { created, consumed };
  }
}
