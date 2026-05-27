import { NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
import { TasksService } from '../tasks.service';

// Mock PrismaClient but preserve the real Prisma namespace (we need
// Prisma.JsonNull, which is a runtime sentinel the service passes through).
jest.mock('../../../prisma/generated/client', () => {
  const actual = jest.requireActual('../../../prisma/generated/client');
  const mockPrisma = {
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { ...actual, PrismaClient: jest.fn(() => mockPrisma) };
});

describe('TasksService (unit)', () => {
  let service: TasksService;
  let prisma: {
    task: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = new (PrismaClient as unknown as new () => typeof prisma)();
    service = new TasksService(prisma as unknown as PrismaClient);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns tasks for the given userId ordered by createdAt desc', async () => {
      const tasks = [{ id: '1', title: 'Task A', userId: 'u1', completed: false }];
      prisma.task.findMany.mockResolvedValueOnce(tasks);

      const result = await service.list('u1');

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(tasks);
    });
  });

  describe('create', () => {
    it('creates a task with title and no dueAt', async () => {
      const created = { id: 'new', title: 'Buy milk', userId: 'u1', completed: false, dueAt: null };
      prisma.task.create.mockResolvedValueOnce(created);

      const result = await service.create('u1', { title: 'Buy milk' });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: { userId: 'u1', title: 'Buy milk', dueAt: null, source: Prisma.JsonNull },
      });
      expect(result).toBe(created);
    });

    it('creates a task with a dueAt date string', async () => {
      const dueAt = '2026-06-01T00:00:00.000Z';
      const created = {
        id: 'new2',
        title: 'Doctor',
        userId: 'u1',
        completed: false,
        dueAt: new Date(dueAt),
      };
      prisma.task.create.mockResolvedValueOnce(created);

      const result = await service.create('u1', { title: 'Doctor', dueAt });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: { userId: 'u1', title: 'Doctor', dueAt: new Date(dueAt), source: Prisma.JsonNull },
      });
      expect(result).toBe(created);
    });

    it('persists the source field as native Json when provided (cross-app provenance)', async () => {
      const source = { app: 'say-things', dictationId: 'd1' };
      const created = {
        id: 'new3',
        title: 'Email Jamie',
        userId: 'u1',
        completed: false,
        dueAt: null,
        source,
      };
      prisma.task.create.mockResolvedValueOnce(created);

      const result = await service.create('u1', { title: 'Email Jamie', source });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          title: 'Email Jamie',
          dueAt: null,
          source,
        },
      });
      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('updates completed status only when partial is { completed }', async () => {
      const existing = { id: 't1', userId: 'u1', title: 'Task', completed: false };
      const updated = { ...existing, completed: true };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(updated);

      const result = await service.update('u1', 't1', { completed: true });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { completed: true },
      });
      expect(result).toBe(updated);
    });

    it('updates title only when partial is { title }', async () => {
      const existing = { id: 't1', userId: 'u1', title: 'Old', completed: false };
      const updated = { ...existing, title: 'New' };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(updated);

      const result = await service.update('u1', 't1', { title: 'New' });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { title: 'New' },
      });
      expect(result).toBe(updated);
    });

    it('sets dueAt to a Date when partial has dueAt as ISO string', async () => {
      const existing = { id: 't1', userId: 'u1', title: 'Task', completed: false, dueAt: null };
      const dueAt = '2026-06-01T00:00:00.000Z';
      const updated = { ...existing, dueAt: new Date(dueAt) };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(updated);

      const result = await service.update('u1', 't1', { dueAt });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { dueAt: new Date(dueAt) },
      });
      expect(result).toBe(updated);
    });

    it('clears dueAt to null when partial has dueAt: null', async () => {
      const existing = {
        id: 't1',
        userId: 'u1',
        title: 'Task',
        completed: false,
        dueAt: new Date(),
      };
      const updated = { ...existing, dueAt: null };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(updated);

      const result = await service.update('u1', 't1', { dueAt: null });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { dueAt: null },
      });
      expect(result).toBe(updated);
    });

    it('updates multiple fields at once', async () => {
      const existing = { id: 't1', userId: 'u1', title: 'Old', completed: false, dueAt: null };
      const dueAt = '2026-07-01T00:00:00.000Z';
      const updated = { ...existing, title: 'New', completed: true, dueAt: new Date(dueAt) };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(updated);

      const result = await service.update('u1', 't1', {
        title: 'New',
        completed: true,
        dueAt,
      });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { title: 'New', completed: true, dueAt: new Date(dueAt) },
      });
      expect(result).toBe(updated);
    });

    it('ignores fields not in partial (does not pass undefined to Prisma)', async () => {
      const existing = { id: 't1', userId: 'u1', title: 'X', completed: false };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(existing);

      await service.update('u1', 't1', {});

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: {},
      });
    });

    it('throws NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('u1', 'missing', { completed: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task belongs to a different user', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'other-user' });
      await expect(service.update('u1', 't1', { completed: true })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the task and returns { ok: true }', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'u1' });
      prisma.task.delete.mockResolvedValueOnce({});

      const result = await service.remove('u1', 't1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to a different user', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'other-user' });
      await expect(service.remove('u1', 't1')).rejects.toThrow(NotFoundException);
    });
  });
});
