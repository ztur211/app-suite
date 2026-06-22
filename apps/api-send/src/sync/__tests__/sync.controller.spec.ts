import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { SyncController } from '../sync.controller';
import { SyncService } from '../sync.service';

const mockSvc = { sync: jest.fn() };

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

describe('SyncController (unit)', () => {
  let controller: SyncController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: mockSvc }],
    }).compile();
    controller = module.get<SyncController>(SyncController);
    jest.clearAllMocks();
  });

  it('POST /sync calls svc.sync with the userId', async () => {
    mockSvc.sync.mockResolvedValueOnce({ created: 2, consumed: 2 });
    const r = await controller.run(makeRequest('u1'));
    expect(mockSvc.sync).toHaveBeenCalledWith('u1');
    expect(r).toEqual({ created: 2, consumed: 2 });
  });
});
