import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramAdapter } from './telegram.adapter';

@Injectable()
export class TelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramAdapter,
  ) {}

  /** Link the caller's account to a Telegram chat (v1: one chat per user). */
  async link(userId: string, chatId: string): Promise<{ ok: true; chatId: string }> {
    const cid = (chatId ?? '').trim();
    if (!cid) throw new BadRequestException('chatId is required');
    const link = await this.prisma.telegramLink.upsert({
      where: { userId },
      create: { userId, chatId: cid },
      update: { chatId: cid },
    });
    return { ok: true, chatId: link.chatId };
  }

  /** Send an outbound Telegram message and mark it sent. */
  async send(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.userId !== userId) throw new NotFoundException();
    if (msg.channel !== 'telegram') {
      throw new BadRequestException('Only telegram messages can be sent here');
    }

    let chatId = msg.recipient?.trim() || null;
    if (!chatId) {
      const link = await this.prisma.telegramLink.findUnique({ where: { userId } });
      chatId = link?.chatId ?? null;
    }
    if (!chatId) throw new BadRequestException('No Telegram recipient or linked chat');

    const result = await this.telegram.sendMessage(chatId, msg.body);
    return this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'sent', providerMessageId: result.providerMessageId, recipient: chatId },
    });
  }

  /**
   * Drain pending Telegram updates (bot-global) and fan them out to linked
   * users as inbound messages. Idempotent: dedups on update_id and advances the
   * cursor even for unlinked chats so they're never reprocessed.
   */
  async syncInbound(): Promise<{ inboundCreated: number; processed: number }> {
    const cursor = await this.prisma.telegramInbound.aggregate({ _max: { updateId: true } });
    const lastUpdateId = cursor._max.updateId;
    const offset = lastUpdateId != null ? Number(lastUpdateId) + 1 : undefined;

    const updates = await this.telegram.getUpdates(offset);
    let inboundCreated = 0;
    let processed = 0;

    for (const u of updates) {
      const seen = await this.prisma.telegramInbound.findUnique({
        where: { updateId: BigInt(u.updateId) },
      });
      if (seen) continue;

      const link = await this.prisma.telegramLink.findUnique({ where: { chatId: u.chatId } });
      let messageId: string | null = null;
      if (link) {
        const created = await this.prisma.message.create({
          data: {
            userId: link.userId,
            channel: 'telegram',
            kind: 'inbound',
            status: 'unread',
            body: u.text,
            recipient: u.chatId,
          },
        });
        messageId = created.id;
        inboundCreated++;
      }

      await this.prisma.telegramInbound.create({
        data: { updateId: BigInt(u.updateId), chatId: u.chatId, messageId },
      });
      processed++;
    }

    return { inboundCreated, processed };
  }
}
