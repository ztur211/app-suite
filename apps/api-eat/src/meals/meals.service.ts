import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MealKind = 'recipe' | 'restaurant' | 'either';
export type MealStatus = 'active' | 'tried';

export interface CreateMealData {
  name: string;
  kind: MealKind;
  notes?: string | null;
  sourceDictationId?: string | null;
}

export interface UpdateMealData {
  name?: string;
  kind?: MealKind;
  notes?: string | null;
  status?: MealStatus;
}

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.mealItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateMealData) {
    return this.prisma.mealItem.create({
      data: {
        userId,
        name: data.name,
        kind: data.kind,
        notes: data.notes ?? null,
        sourceDictationId: data.sourceDictationId ?? null,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateMealData) {
    const existing = await this.prisma.mealItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();

    const updateData: {
      name?: string;
      kind?: string;
      notes?: string | null;
      status?: string;
    } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.kind !== undefined) updateData.kind = data.kind;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.mealItem.update({ where: { id }, data: updateData });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.mealItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    await this.prisma.mealItem.delete({ where: { id } });
    return { ok: true };
  }
}
