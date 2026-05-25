import { Injectable } from '@nestjs/common';
import { SaySdk } from '@things/say-sdk';
import type { MealPayload } from '@things/types';
import { PrismaService } from '../prisma/prisma.service';

export interface SyncResult {
  created: number;
  consumed: number;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saySdk: SaySdk,
  ) {}

  /**
   * Pull PENDING_EAT items from api-say for the user, idempotently insert
   * each as a MealItem keyed on sourceDictationId, then mark consumed in Say.
   */
  async sync(userId: string): Promise<SyncResult> {
    const pending = await this.saySdk.pending.list({ userId, destination: 'PENDING_EAT' });

    let created = 0;
    let consumed = 0;

    for (const p of pending) {
      const existing = await this.prisma.mealItem.findFirst({
        where: { userId, sourceDictationId: p.dictationId },
      });

      let item = existing;
      if (!item) {
        const payload = p.payload as MealPayload;
        item = await this.prisma.mealItem.create({
          data: {
            userId,
            name: payload.name,
            kind: payload.kind,
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
