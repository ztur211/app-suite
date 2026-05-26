import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MessageChannel = 'email' | 'slack' | 'discord' | 'telegram';
export type MessageKind = 'outbound' | 'inbound';
export type MessageStatus = 'draft' | 'sent' | 'unread' | 'read' | 'archived';

export interface CreateMessageData {
  channel: MessageChannel;
  body: string;
  subject?: string | null;
  recipient?: string | null;
  sourceDictationId?: string | null;
}

export interface UpdateMessageData {
  channel?: MessageChannel;
  body?: string;
  subject?: string | null;
  recipient?: string | null;
  status?: MessageStatus;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: CreateMessageData) {
    return this.prisma.message.create({
      data: {
        userId,
        channel: data.channel,
        kind: 'outbound',
        status: 'draft',
        subject: data.subject ?? null,
        body: data.body,
        recipient: data.recipient ?? null,
        sourceDictationId: data.sourceDictationId ?? null,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateMessageData) {
    const existing = await this.prisma.message.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();

    const updateData: {
      channel?: string;
      body?: string;
      subject?: string | null;
      recipient?: string | null;
      status?: string;
    } = {};
    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.recipient !== undefined) updateData.recipient = data.recipient;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.message.update({ where: { id }, data: updateData });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.message.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    await this.prisma.message.delete({ where: { id } });
    return { ok: true };
  }
}
