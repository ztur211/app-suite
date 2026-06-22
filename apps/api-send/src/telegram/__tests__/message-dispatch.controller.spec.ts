import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { MessageDispatchController } from '../message-dispatch.controller';
import { TelegramService } from '../telegram.service';

const mockSvc = { send: jest.fn(), syncInbound: jest.fn() };

jest.mock('../../auth/session.guard', () => ({
  SessionGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../../auth/auth', () => ({ auth: { api: { getSession: jest.fn() } } }));

function makeRequest(userId: string) {
  return { userId } as unknown as Request & { userId: string };
}

describe('MessageDispatchController (unit)', () => {
  let controller: MessageDispatchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageDispatchController],
      providers: [{ provide: TelegramService, useValue: mockSvc }],
    }).compile();
    controller = module.get<MessageDispatchController>(MessageDispatchController);
    jest.clearAllMocks();
  });

  it('POST /messages/:id/send forwards userId + id', async () => {
    mockSvc.send.mockResolvedValueOnce({ id: 'm1', status: 'sent' });
    const r = await controller.send(makeRequest('u1'), 'm1');
    expect(mockSvc.send).toHaveBeenCalledWith('u1', 'm1');
    expect(r).toEqual({ id: 'm1', status: 'sent' });
  });

  it('POST /messages/sync delegates to syncInbound', async () => {
    mockSvc.syncInbound.mockResolvedValueOnce({ inboundCreated: 2, processed: 3 });
    const r = await controller.sync();
    expect(mockSvc.syncInbound).toHaveBeenCalled();
    expect(r).toEqual({ inboundCreated: 2, processed: 3 });
  });
});
