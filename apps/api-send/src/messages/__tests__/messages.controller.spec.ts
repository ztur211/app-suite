import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from '../messages.controller';
import { MessagesService } from '../messages.service';

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

describe('MessagesController (unit)', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [{ provide: MessagesService, useValue: mockSvc }],
    }).compile();
    controller = module.get<MessagesController>(MessagesController);
    jest.clearAllMocks();
  });

  it('GET /messages calls svc.list', async () => {
    mockSvc.list.mockResolvedValueOnce([{ id: '1' }]);
    const result = await controller.list(makeRequest('u1'));
    expect(mockSvc.list).toHaveBeenCalledWith('u1');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('POST /messages creates with channel + body', async () => {
    mockSvc.create.mockResolvedValueOnce({ id: 'new' });
    await controller.create(makeRequest('u1'), { channel: 'email', body: 'hi' });
    expect(mockSvc.create).toHaveBeenCalledWith('u1', { channel: 'email', body: 'hi' });
  });

  it('PATCH /messages/:id updates partial', async () => {
    mockSvc.update.mockResolvedValueOnce({ id: 'm1' });
    await controller.patch(makeRequest('u1'), 'm1', { status: 'sent' });
    expect(mockSvc.update).toHaveBeenCalledWith('u1', 'm1', { status: 'sent' });
  });

  it('DELETE /messages/:id calls svc.remove', async () => {
    mockSvc.remove.mockResolvedValueOnce({ ok: true });
    await controller.remove(makeRequest('u1'), 'm1');
    expect(mockSvc.remove).toHaveBeenCalledWith('u1', 'm1');
  });
});
