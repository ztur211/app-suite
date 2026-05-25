import { NotFoundException } from '@nestjs/common';
import { MealsService } from '../meals.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MealsService (unit)', () => {
  let prisma: {
    mealItem: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: MealsService;

  beforeEach(() => {
    prisma = {
      mealItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new MealsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns meals for userId ordered by createdAt desc', async () => {
      const meals = [{ id: 'm1', name: 'Pasta', kind: 'recipe' }];
      prisma.mealItem.findMany.mockResolvedValueOnce(meals);
      const result = await service.list('u1');
      expect(prisma.mealItem.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(meals);
    });
  });

  describe('create', () => {
    it('creates a recipe with name + kind only', async () => {
      const created = { id: 'new', name: 'Tacos', kind: 'recipe' };
      prisma.mealItem.create.mockResolvedValueOnce(created);
      await service.create('u1', { name: 'Tacos', kind: 'recipe' });
      expect(prisma.mealItem.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          name: 'Tacos',
          kind: 'recipe',
          notes: null,
          sourceDictationId: null,
        },
      });
    });

    it('creates a restaurant with notes + sourceDictationId', async () => {
      prisma.mealItem.create.mockResolvedValueOnce({ id: 'm2' });
      await service.create('u1', {
        name: "Joe's",
        kind: 'restaurant',
        notes: 'try the burger',
        sourceDictationId: 'dict-1',
      });
      expect(prisma.mealItem.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          name: "Joe's",
          kind: 'restaurant',
          notes: 'try the burger',
          sourceDictationId: 'dict-1',
        },
      });
    });
  });

  describe('update', () => {
    it('updates name only', async () => {
      const existing = { id: 'm1', userId: 'u1', name: 'Old' };
      prisma.mealItem.findUnique.mockResolvedValueOnce(existing);
      prisma.mealItem.update.mockResolvedValueOnce({ ...existing, name: 'New' });
      await service.update('u1', 'm1', { name: 'New' });
      expect(prisma.mealItem.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { name: 'New' },
      });
    });

    it('changes kind from either to recipe', async () => {
      const existing = { id: 'm1', userId: 'u1', kind: 'either' };
      prisma.mealItem.findUnique.mockResolvedValueOnce(existing);
      prisma.mealItem.update.mockResolvedValueOnce({ ...existing, kind: 'recipe' });
      await service.update('u1', 'm1', { kind: 'recipe' });
      expect(prisma.mealItem.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { kind: 'recipe' },
      });
    });

    it('marks tried via status update', async () => {
      const existing = { id: 'm1', userId: 'u1', status: 'active' };
      prisma.mealItem.findUnique.mockResolvedValueOnce(existing);
      prisma.mealItem.update.mockResolvedValueOnce({ ...existing, status: 'tried' });
      await service.update('u1', 'm1', { status: 'tried' });
      expect(prisma.mealItem.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'tried' },
      });
    });

    it('clears notes when notes: null', async () => {
      const existing = { id: 'm1', userId: 'u1', notes: 'old' };
      prisma.mealItem.findUnique.mockResolvedValueOnce(existing);
      prisma.mealItem.update.mockResolvedValueOnce(existing);
      await service.update('u1', 'm1', { notes: null });
      expect(prisma.mealItem.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { notes: null },
      });
    });

    it('throws NotFoundException when meal does not exist', async () => {
      prisma.mealItem.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('u1', 'missing', { status: 'tried' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when meal belongs to a different user', async () => {
      prisma.mealItem.findUnique.mockResolvedValueOnce({ id: 'm1', userId: 'other' });
      await expect(service.update('u1', 'm1', { status: 'tried' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes and returns ok', async () => {
      prisma.mealItem.findUnique.mockResolvedValueOnce({ id: 'm1', userId: 'u1' });
      prisma.mealItem.delete.mockResolvedValueOnce({});
      const result = await service.remove('u1', 'm1');
      expect(prisma.mealItem.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.mealItem.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
