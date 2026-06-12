import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateTaskData {
  title?: string;
  /** ISO 8601 string to set, or null to clear. Omit to leave unchanged. */
  dueAt?: string | null;
  completed?: boolean;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(
    userId: string,
    data: {
      title: string;
      dueAt?: string;
      source?: { app: string; dictationId?: string; [k: string]: unknown };
    },
  ) {
    return this.prisma.task.create({
      data: {
        userId,
        title: data.title,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        source: data.source ? (data.source as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateTaskData) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();

    const updateData: { title?: string; dueAt?: Date | null; completed?: boolean } = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.dueAt !== undefined) updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (data.completed !== undefined) updateData.completed = data.completed;

    return this.prisma.task.update({ where: { id }, data: updateData });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}
