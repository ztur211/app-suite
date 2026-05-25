import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaClient) {}

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
        source: data.source ? JSON.stringify(data.source) : null,
      },
    });
  }

  async setCompleted(userId: string, id: string, completed: boolean) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    return this.prisma.task.update({ where: { id }, data: { completed } });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}
