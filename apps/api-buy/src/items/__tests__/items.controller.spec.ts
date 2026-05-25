import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from '../items.controller';
import { ItemsService } from '../items.service';

const mockSvc = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

jest.mock('../../auth/session.guard', () => ({
  SessionGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../../auth/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

import type { Request } from 'express';

function makeRequest(userId: string) {
  return { userId } as unknown as Request & { userId: string };
}

describe('ItemsController (unit)', () => {
  let controller: ItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [{ provide: ItemsService, useValue: mockSvc }],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
    jest.clearAllMocks();
  });

  it('GET /items calls svc.list with userId', async () => {
    const items = [{ id: '1' }];
    mockSvc.list.mockResolvedValueOnce(items);

    const result = await controller.list(makeRequest('u1'));
    expect(mockSvc.list).toHaveBeenCalledWith('u1');
    expect(result).toBe(items);
  });

  it('POST /items calls svc.create with userId and body', async () => {
    const item = { id: 'new', title: 'Eggs' };
    mockSvc.create.mockResolvedValueOnce(item);

    const result = await controller.create(makeRequest('u1'), {
      title: 'Eggs',
      quantity: 12,
    });

    expect(mockSvc.create).toHaveBeenCalledWith('u1', { title: 'Eggs', quantity: 12 });
    expect(result).toBe(item);
  });

  it('PATCH /items/:id forwards partial body to svc.update', async () => {
    const updated = { id: 'i1', status: 'bought' };
    mockSvc.update.mockResolvedValueOnce(updated);

    const result = await controller.patch(makeRequest('u1'), 'i1', { status: 'bought' });
    expect(mockSvc.update).toHaveBeenCalledWith('u1', 'i1', { status: 'bought' });
    expect(result).toBe(updated);
  });

  it('DELETE /items/:id calls svc.remove', async () => {
    mockSvc.remove.mockResolvedValueOnce({ ok: true });

    const result = await controller.remove(makeRequest('u1'), 'i1');
    expect(mockSvc.remove).toHaveBeenCalledWith('u1', 'i1');
    expect(result).toEqual({ ok: true });
  });
});
