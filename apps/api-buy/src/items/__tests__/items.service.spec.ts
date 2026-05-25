import { NotFoundException } from '@nestjs/common';
import { ItemsService } from '../items.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ItemsService (unit)', () => {
  let service: ItemsService;
  let prisma: {
    shoppingItem: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      shoppingItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new ItemsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns items for the given userId ordered by createdAt desc', async () => {
      const items = [{ id: '1', title: 'Milk', userId: 'u1', status: 'active' }];
      prisma.shoppingItem.findMany.mockResolvedValueOnce(items);

      const result = await service.list('u1');

      expect(prisma.shoppingItem.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(items);
    });
  });

  describe('create', () => {
    it('creates an item with title only (defaults quantity/notes/sourceDictationId to null)', async () => {
      const created = {
        id: 'new',
        title: 'Eggs',
        userId: 'u1',
        status: 'active',
        quantity: null,
        notes: null,
        sourceDictationId: null,
      };
      prisma.shoppingItem.create.mockResolvedValueOnce(created);

      const result = await service.create('u1', { title: 'Eggs' });

      expect(prisma.shoppingItem.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          title: 'Eggs',
          quantity: null,
          notes: null,
          sourceDictationId: null,
        },
      });
      expect(result).toBe(created);
    });

    it('persists quantity, notes, and sourceDictationId when provided', async () => {
      const created = { id: 'n2' };
      prisma.shoppingItem.create.mockResolvedValueOnce(created);

      await service.create('u1', {
        title: 'Apples',
        quantity: 6,
        notes: 'Granny Smith',
        sourceDictationId: 'dict-1',
      });

      expect(prisma.shoppingItem.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          title: 'Apples',
          quantity: 6,
          notes: 'Granny Smith',
          sourceDictationId: 'dict-1',
        },
      });
    });
  });

  describe('update', () => {
    it('updates title only when partial is { title }', async () => {
      const existing = { id: 'i1', userId: 'u1', title: 'Old', status: 'active' };
      prisma.shoppingItem.findUnique.mockResolvedValueOnce(existing);
      prisma.shoppingItem.update.mockResolvedValueOnce({ ...existing, title: 'New' });

      const result = await service.update('u1', 'i1', { title: 'New' });

      expect(prisma.shoppingItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { title: 'New' },
      });
      expect(result.title).toBe('New');
    });

    it('marks item as bought when status: "bought"', async () => {
      const existing = { id: 'i1', userId: 'u1', title: 'Milk', status: 'active' };
      prisma.shoppingItem.findUnique.mockResolvedValueOnce(existing);
      prisma.shoppingItem.update.mockResolvedValueOnce({ ...existing, status: 'bought' });

      await service.update('u1', 'i1', { status: 'bought' });

      expect(prisma.shoppingItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { status: 'bought' },
      });
    });

    it('clears quantity when partial has quantity: null', async () => {
      const existing = { id: 'i1', userId: 'u1', quantity: 5 };
      prisma.shoppingItem.findUnique.mockResolvedValueOnce(existing);
      prisma.shoppingItem.update.mockResolvedValueOnce(existing);

      await service.update('u1', 'i1', { quantity: null });

      expect(prisma.shoppingItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { quantity: null },
      });
    });

    it('updates multiple fields at once', async () => {
      const existing = { id: 'i1', userId: 'u1', title: 'Old', quantity: 1, notes: null };
      prisma.shoppingItem.findUnique.mockResolvedValueOnce(existing);
      prisma.shoppingItem.update.mockResolvedValueOnce(existing);

      await service.update('u1', 'i1', {
        title: 'New',
        quantity: 3,
        notes: 'organic',
        status: 'bought',
      });

      expect(prisma.shoppingItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { title: 'New', quantity: 3, notes: 'organic', status: 'bought' },
      });
    });

    it('throws NotFoundException when item does not exist', async () => {
      prisma.shoppingItem.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('u1', 'missing', { status: 'bought' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when item belongs to a different user', async () => {
      prisma.shoppingItem.findUnique.mockResolvedValueOnce({ id: 'i1', userId: 'other' });
      await expect(service.update('u1', 'i1', { status: 'bought' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the item and returns { ok: true }', async () => {
      prisma.shoppingItem.findUnique.mockResolvedValueOnce({ id: 'i1', userId: 'u1' });
      prisma.shoppingItem.delete.mockResolvedValueOnce({});

      const result = await service.remove('u1', 'i1');

      expect(prisma.shoppingItem.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when item does not exist', async () => {
      prisma.shoppingItem.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when item belongs to a different user', async () => {
      prisma.shoppingItem.findUnique.mockResolvedValueOnce({ id: 'i1', userId: 'other' });
      await expect(service.remove('u1', 'i1')).rejects.toThrow(NotFoundException);
    });
  });
});
