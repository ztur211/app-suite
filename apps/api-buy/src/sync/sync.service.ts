import { Injectable } from '@nestjs/common';
import { SaySdk } from '@things/say-sdk';
import type { ShoppingPayload } from '@things/types';
import { PrismaService } from '../prisma/prisma.service';

export interface SyncResult {
  /** Number of new ShoppingItem rows inserted this run. */
  created: number;
  /** Number of pending dictations consumed in Say this run. */
  consumed: number;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saySdk: SaySdk,
  ) {}

  /**
   * Pull all PENDING_BUY items from api-say for the given user, idempotently
   * insert them as ShoppingItem rows (keyed by sourceDictationId), and mark
   * each consumed in Say with the new ShoppingItem id.
   */
  async sync(userId: string): Promise<SyncResult> {
    const pending = await this.saySdk.pending.list({ userId, destination: 'PENDING_BUY' });

    let created = 0;
    let consumed = 0;

    for (const p of pending) {
      const existing = await this.prisma.shoppingItem.findFirst({
        where: { userId, sourceDictationId: p.dictationId },
      });

      let item = existing;
      if (!item) {
        const payload = p.payload as ShoppingPayload;
        item = await this.prisma.shoppingItem.create({
          data: {
            userId,
            title: payload.item,
            quantity: payload.quantity ?? null,
            notes: payload.notes ?? null,
            sourceDictationId: p.dictationId,
          },
        });
        created++;
      }

      await this.saySdk.pending.consume(p.dictationId, { userId, destinationRef: item.id });
      consumed++;
    }

    return { created, consumed };
  }
}
