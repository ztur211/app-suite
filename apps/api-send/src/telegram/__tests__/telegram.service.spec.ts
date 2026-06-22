import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramAdapter } from '../telegram.adapter';

function makePrisma() {
  return {
    telegramLink: { upsert: jest.fn(), findUnique: jest.fn() },
    telegramInbound: { aggregate: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    message: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  };
}

describe('TelegramService (unit)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let adapter: { sendMessage: jest.Mock; getUpdates: jest.Mock };
  let service: TelegramService;

  beforeEach(() => {
    prisma = makePrisma();
    adapter = { sendMessage: jest.fn(), getUpdates: jest.fn() };
    service = new TelegramService(
      prisma as unknown as PrismaService,
      adapter as unknown as TelegramAdapter,
    );
  });

  describe('link', () => {
    it('upserts a TelegramLink for the user (trimming the chatId)', async () => {
      prisma.telegramLink.upsert.mockResolvedValueOnce({ userId: 'u1', chatId: '99' });
      const r = await service.link('u1', ' 99 ');
      expect(prisma.telegramLink.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        create: { userId: 'u1', chatId: '99' },
        update: { chatId: '99' },
      });
      expect(r).toEqual({ ok: true, chatId: '99' });
    });

    it('rejects an empty chatId', async () => {
      await expect(service.link('u1', '   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('send', () => {
    it('sends to the message recipient and marks it sent', async () => {
      prisma.message.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'u1',
        channel: 'telegram',
        body: 'hi',
        recipient: '99',
      });
      adapter.sendMessage.mockResolvedValueOnce({ providerMessageId: '500', chatId: '99' });
      prisma.message.update.mockResolvedValueOnce({ id: 'm1', status: 'sent' });

      const r = await service.send('u1', 'm1');

      expect(adapter.sendMessage).toHaveBeenCalledWith('99', 'hi');
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'sent', providerMessageId: '500', recipient: '99' },
      });
      expect(r).toEqual({ id: 'm1', status: 'sent' });
    });

    it('falls back to the user link when the message has no recipient', async () => {
      prisma.message.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'u1',
        channel: 'telegram',
        body: 'hi',
        recipient: null,
      });
      prisma.telegramLink.findUnique.mockResolvedValueOnce({ userId: 'u1', chatId: '77' });
      adapter.sendMessage.mockResolvedValueOnce({ providerMessageId: '1', chatId: '77' });
      prisma.message.update.mockResolvedValueOnce({ id: 'm1' });

      await service.send('u1', 'm1');

      expect(adapter.sendMessage).toHaveBeenCalledWith('77', 'hi');
    });

    it('404s when the message is missing or not owned', async () => {
      prisma.message.findUnique.mockResolvedValueOnce(null);
      await expect(service.send('u1', 'mX')).rejects.toThrow(NotFoundException);

      prisma.message.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'other',
        channel: 'telegram',
      });
      await expect(service.send('u1', 'm1')).rejects.toThrow(NotFoundException);
    });

    it('400s for a non-telegram channel', async () => {
      prisma.message.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'u1',
        channel: 'email',
        body: 'x',
        recipient: 'a@b.c',
      });
      await expect(service.send('u1', 'm1')).rejects.toThrow(BadRequestException);
    });

    it('400s when there is no recipient and no link', async () => {
      prisma.message.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'u1',
        channel: 'telegram',
        body: 'x',
        recipient: null,
      });
      prisma.telegramLink.findUnique.mockResolvedValueOnce(null);
      await expect(service.send('u1', 'm1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncInbound', () => {
    it('uses max(updateId)+1 as offset and creates inbound messages for linked chats', async () => {
      prisma.telegramInbound.aggregate.mockResolvedValueOnce({ _max: { updateId: BigInt(10) } });
      adapter.getUpdates.mockResolvedValueOnce([
        { updateId: 11, chatId: '99', fromUsername: 'a', text: 'hello', date: 1 },
      ]);
      prisma.telegramInbound.findUnique.mockResolvedValueOnce(null);
      prisma.telegramLink.findUnique.mockResolvedValueOnce({ userId: 'u1', chatId: '99' });
      prisma.message.create.mockResolvedValueOnce({ id: 'mNew' });
      prisma.telegramInbound.create.mockResolvedValueOnce({});

      const r = await service.syncInbound();

      expect(adapter.getUpdates).toHaveBeenCalledWith(11);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          channel: 'telegram',
          kind: 'inbound',
          status: 'unread',
          body: 'hello',
          recipient: '99',
        },
      });
      expect(prisma.telegramInbound.create).toHaveBeenCalledWith({
        data: { updateId: BigInt(11), chatId: '99', messageId: 'mNew' },
      });
      expect(r).toEqual({ inboundCreated: 1, processed: 1 });
    });

    it('uses no offset without a cursor and skips already-seen updates', async () => {
      prisma.telegramInbound.aggregate.mockResolvedValueOnce({ _max: { updateId: null } });
      adapter.getUpdates.mockResolvedValueOnce([
        { updateId: 5, chatId: '99', fromUsername: null, text: 'dup', date: 1 },
      ]);
      prisma.telegramInbound.findUnique.mockResolvedValueOnce({ updateId: BigInt(5) });

      const r = await service.syncInbound();

      expect(adapter.getUpdates).toHaveBeenCalledWith(undefined);
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(prisma.telegramInbound.create).not.toHaveBeenCalled();
      expect(r).toEqual({ inboundCreated: 0, processed: 0 });
    });

    it('advances the cursor for unlinked chats without creating a message', async () => {
      prisma.telegramInbound.aggregate.mockResolvedValueOnce({ _max: { updateId: null } });
      adapter.getUpdates.mockResolvedValueOnce([
        { updateId: 7, chatId: '88', fromUsername: 'x', text: 'who?', date: 1 },
      ]);
      prisma.telegramInbound.findUnique.mockResolvedValueOnce(null);
      prisma.telegramLink.findUnique.mockResolvedValueOnce(null);
      prisma.telegramInbound.create.mockResolvedValueOnce({});

      const r = await service.syncInbound();

      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(prisma.telegramInbound.create).toHaveBeenCalledWith({
        data: { updateId: BigInt(7), chatId: '88', messageId: null },
      });
      expect(r).toEqual({ inboundCreated: 0, processed: 1 });
    });
  });
});
