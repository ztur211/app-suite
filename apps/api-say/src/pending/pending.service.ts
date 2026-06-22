import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

export type PendingDestination = 'PENDING_BUY' | 'PENDING_EAT' | 'PENDING_SEND';

export interface PendingItem {
  dictationId: string;
  createdAt: string;
  payload: Prisma.JsonValue;
  transcript: string;
}

@Injectable()
export class PendingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, destination: PendingDestination): Promise<PendingItem[]> {
    const rows = await this.prisma.dictation.findMany({
      where: { userId, destination, state: 'dispatched', destinationRef: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      dictationId: r.id,
      createdAt: r.createdAt.toISOString(),
      payload: r.editedPayload ?? r.proposedPayload,
      transcript: r.finalTranscript,
    }));
  }

  async consume(
    dictationId: string,
    userId: string,
    destinationRef: string,
  ): Promise<{ ok: true }> {
    const row = await this.prisma.dictation.findUnique({ where: { id: dictationId } });
    if (!row || row.userId !== userId) throw new NotFoundException();
    if (row.destinationRef) return { ok: true };
    await this.prisma.dictation.update({
      where: { id: dictationId },
      data: { destinationRef },
    });
    return { ok: true };
  }
}
