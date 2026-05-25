import { Test, TestingModule } from '@nestjs/testing';
import { MealsController } from '../meals.controller';
import { MealsService } from '../meals.service';

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

describe('MealsController (unit)', () => {
  let controller: MealsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MealsController],
      providers: [{ provide: MealsService, useValue: mockSvc }],
    }).compile();
    controller = module.get<MealsController>(MealsController);
    jest.clearAllMocks();
  });

  it('GET /meals calls svc.list', async () => {
    mockSvc.list.mockResolvedValueOnce([{ id: '1' }]);
    const result = await controller.list(makeRequest('u1'));
    expect(mockSvc.list).toHaveBeenCalledWith('u1');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('POST /meals creates with name + kind', async () => {
    mockSvc.create.mockResolvedValueOnce({ id: 'new' });
    await controller.create(makeRequest('u1'), { name: 'Tacos', kind: 'recipe' });
    expect(mockSvc.create).toHaveBeenCalledWith('u1', { name: 'Tacos', kind: 'recipe' });
  });

  it('PATCH /meals/:id updates partial', async () => {
    mockSvc.update.mockResolvedValueOnce({ id: 'm1' });
    await controller.patch(makeRequest('u1'), 'm1', { status: 'tried' });
    expect(mockSvc.update).toHaveBeenCalledWith('u1', 'm1', { status: 'tried' });
  });

  it('DELETE /meals/:id calls svc.remove', async () => {
    mockSvc.remove.mockResolvedValueOnce({ ok: true });
    await controller.remove(makeRequest('u1'), 'm1');
    expect(mockSvc.remove).toHaveBeenCalledWith('u1', 'm1');
  });
});
