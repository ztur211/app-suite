import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from '../tasks.controller';
import { TasksService } from '../tasks.service';

const mockTasksService = {
  list: jest.fn(),
  create: jest.fn(),
  setCompleted: jest.fn(),
  remove: jest.fn(),
};

// Mock the SessionGuard so controller unit tests don't need DB
jest.mock('../../auth/session.guard', () => ({
  SessionGuard: class {
    canActivate() {
      return true;
    }
  },
}));

// Mock auth module too
jest.mock('../../auth/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

import type { Request } from 'express';

function makeRequest(userId: string) {
  return { userId } as unknown as Request & { userId: string };
}

describe('TasksController (unit)', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockTasksService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    jest.clearAllMocks();
  });

  it('GET /tasks calls service.list with userId', async () => {
    const tasks = [{ id: '1', title: 'Task' }];
    mockTasksService.list.mockResolvedValueOnce(tasks);

    const result = await controller.list(makeRequest('u1'));
    expect(mockTasksService.list).toHaveBeenCalledWith('u1');
    expect(result).toBe(tasks);
  });

  it('POST /tasks calls service.create with userId and body', async () => {
    const task = { id: 'new', title: 'New Task' };
    mockTasksService.create.mockResolvedValueOnce(task);

    const result = await controller.create(makeRequest('u1'), { title: 'New Task' });
    expect(mockTasksService.create).toHaveBeenCalledWith('u1', { title: 'New Task' });
    expect(result).toBe(task);
  });

  it('PATCH /tasks/:id calls service.setCompleted', async () => {
    const updated = { id: 't1', completed: true };
    mockTasksService.setCompleted.mockResolvedValueOnce(updated);

    const result = await controller.patch(makeRequest('u1'), 't1', { completed: true });
    expect(mockTasksService.setCompleted).toHaveBeenCalledWith('u1', 't1', true);
    expect(result).toBe(updated);
  });

  it('DELETE /tasks/:id calls service.remove', async () => {
    mockTasksService.remove.mockResolvedValueOnce({ ok: true });

    const result = await controller.remove(makeRequest('u1'), 't1');
    expect(mockTasksService.remove).toHaveBeenCalledWith('u1', 't1');
    expect(result).toEqual({ ok: true });
  });
});
