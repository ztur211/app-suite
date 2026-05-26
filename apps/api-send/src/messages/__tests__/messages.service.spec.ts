import { NotFoundException } from '@nestjs/common';
import { MessagesService } from '../messages.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MessagesService (unit)', () => {
  let prisma: {
    message: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: MessagesService;

  beforeEach(() => {
    prisma = {
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new MessagesService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns messages for userId ordered by createdAt desc', async () => {
      const rows = [{ id: 'm1', subject: 'Hi' }];
      prisma.message.findMany.mockResolvedValueOnce(rows);
      const result = await service.list('u1');
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('create', () => {
    it('creates an email draft with subject + body + recipient', async () => {
      prisma.message.create.mockResolvedValueOnce({ id: 'new' });
      await service.create('u1', {
        channel: 'email',
        subject: 'Hello',
        body: 'How are you',
        recipient: 'jane@example.com',
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          channel: 'email',
          kind: 'outbound',
          status: 'draft',
          subject: 'Hello',
          body: 'How are you',
          recipient: 'jane@example.com',
          sourceDictationId: null,
        },
      });
    });

    it('creates a slack draft with body only', async () => {
      prisma.message.create.mockResolvedValueOnce({ id: 'new' });
      await service.create('u1', {
        channel: 'slack',
        body: 'ping',
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          channel: 'slack',
          kind: 'outbound',
          status: 'draft',
          subject: null,
          body: 'ping',
          recipient: null,
          sourceDictationId: null,
        },
      });
    });
  });

  describe('update', () => {
    it('updates body only', async () => {
      const existing = { id: 'm1', userId: 'u1', body: 'old' };
      prisma.message.findUnique.mockResolvedValueOnce(existing);
      prisma.message.update.mockResolvedValueOnce({ ...existing, body: 'new' });
      await service.update('u1', 'm1', { body: 'new' });
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { body: 'new' },
      });
    });

    it('marks sent via status update', async () => {
      const existing = { id: 'm1', userId: 'u1', status: 'draft' };
      prisma.message.findUnique.mockResolvedValueOnce(existing);
      prisma.message.update.mockResolvedValueOnce({ ...existing, status: 'sent' });
      await service.update('u1', 'm1', { status: 'sent' });
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'sent' },
      });
    });

    it('clears subject when subject: null', async () => {
      const existing = { id: 'm1', userId: 'u1', subject: 'old' };
      prisma.message.findUnique.mockResolvedValueOnce(existing);
      prisma.message.update.mockResolvedValueOnce(existing);
      await service.update('u1', 'm1', { subject: null });
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { subject: null },
      });
    });

    it('throws NotFoundException when message does not exist', async () => {
      prisma.message.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('u1', 'missing', { status: 'sent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when message belongs to a different user', async () => {
      prisma.message.findUnique.mockResolvedValueOnce({ id: 'm1', userId: 'other' });
      await expect(service.update('u1', 'm1', { status: 'sent' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes and returns ok', async () => {
      prisma.message.findUnique.mockResolvedValueOnce({ id: 'm1', userId: 'u1' });
      prisma.message.delete.mockResolvedValueOnce({});
      const result = await service.remove('u1', 'm1');
      expect(prisma.message.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.message.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
