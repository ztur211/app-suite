import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateItemData {
  title: string;
  quantity?: number | null;
  notes?: string | null;
  sourceDictationId?: string | null;
}

export interface UpdateItemData {
  title?: string;
  /** Clear with null; leave unchanged with undefined. */
  quantity?: number | null;
  notes?: string | null;
  status?: 'active' | 'bought';
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.shoppingItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateItemData) {
    return this.prisma.shoppingItem.create({
      data: {
        userId,
        title: data.title,
        quantity: data.quantity ?? null,
        notes: data.notes ?? null,
        sourceDictationId: data.sourceDictationId ?? null,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateItemData) {
    const existing = await this.prisma.shoppingItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();

    const updateData: {
      title?: string;
      quantity?: number | null;
      notes?: string | null;
      status?: string;
    } = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.shoppingItem.update({ where: { id }, data: updateData });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.shoppingItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    await this.prisma.shoppingItem.delete({ where: { id } });
    return { ok: true };
  }
}
