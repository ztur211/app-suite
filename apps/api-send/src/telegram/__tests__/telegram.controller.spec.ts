import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { TelegramController } from '../telegram.controller';
import { TelegramService } from '../telegram.service';

const mockSvc = { link: jest.fn() };

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

describe('TelegramController (unit)', () => {
  let controller: TelegramController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [{ provide: TelegramService, useValue: mockSvc }],
    }).compile();
    controller = module.get<TelegramController>(TelegramController);
    jest.clearAllMocks();
  });

  it('POST /telegram/link forwards userId + chatId to the service', async () => {
    mockSvc.link.mockResolvedValueOnce({ ok: true, chatId: '99' });
    const r = await controller.link(makeRequest('u1'), { chatId: '99' });
    expect(mockSvc.link).toHaveBeenCalledWith('u1', '99');
    expect(r).toEqual({ ok: true, chatId: '99' });
  });
});
