import { SaySdk, type PendingItem } from '@things/say-sdk';
import { SyncService } from '../sync.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SyncService (unit)', () => {
  let prisma: {
    mealItem: { findFirst: jest.Mock; create: jest.Mock };
  };
  let saySdk: { pending: { list: jest.Mock; consume: jest.Mock } };
  let service: SyncService;

  beforeEach(() => {
    prisma = { mealItem: { findFirst: jest.fn(), create: jest.fn() } };
    saySdk = { pending: { list: jest.fn(), consume: jest.fn() } };
    service = new SyncService(prisma as unknown as PrismaService, saySdk as unknown as SaySdk);
  });

  function makePending(overrides: Partial<PendingItem> = {}): PendingItem {
    return {
      dictationId: 'dict-1',
      createdAt: new Date().toISOString(),
      transcript: 'I want to try tacos',
      payload: { name: 'tacos', kind: 'recipe', notes: undefined },
      ...overrides,
    };
  }

  it('inserts each pending meal and consumes in Say', async () => {
    saySdk.pending.list.mockResolvedValueOnce([
      makePending({ dictationId: 'd1', payload: { name: 'tacos', kind: 'recipe' } }),
      makePending({
        dictationId: 'd2',
        payload: { name: "Joe's diner", kind: 'restaurant', notes: 'old-school' },
      }),
    ]);
    prisma.mealItem.findFirst.mockResolvedValue(null);
    prisma.mealItem.create
      .mockResolvedValueOnce({ id: 'm1', sourceDictationId: 'd1' })
      .mockResolvedValueOnce({ id: 'm2', sourceDictationId: 'd2' });
    saySdk.pending.consume.mockResolvedValue({ ok: true });

    const result = await service.sync('u1');

    expect(prisma.mealItem.create).toHaveBeenCalledTimes(2);
    expect(prisma.mealItem.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: 'u1',
        name: 'tacos',
        kind: 'recipe',
        notes: null,
        sourceDictationId: 'd1',
      },
    });
    expect(prisma.mealItem.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: 'u1',
        name: "Joe's diner",
        kind: 'restaurant',
        notes: 'old-school',
        sourceDictationId: 'd2',
      },
    });

    expect(saySdk.pending.consume).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ created: 2, consumed: 2 });
  });

  it('skips create when sourceDictationId already exists, still consumes', async () => {
    saySdk.pending.list.mockResolvedValueOnce([makePending({ dictationId: 'd1' })]);
    prisma.mealItem.findFirst.mockResolvedValueOnce({
      id: 'pre-existing',
      sourceDictationId: 'd1',
    });
    saySdk.pending.consume.mockResolvedValueOnce({ ok: true });

    const result = await service.sync('u1');
    expect(prisma.mealItem.create).not.toHaveBeenCalled();
    expect(saySdk.pending.consume).toHaveBeenCalledWith('d1', {
      userId: 'u1',
      destinationRef: 'pre-existing',
    });
    expect(result).toEqual({ created: 0, consumed: 1 });
  });

  it('uses destination PENDING_EAT', async () => {
    saySdk.pending.list.mockResolvedValueOnce([]);
    await service.sync('u42');
    expect(saySdk.pending.list).toHaveBeenCalledWith({
      userId: 'u42',
      destination: 'PENDING_EAT',
    });
  });

  it('returns zeros when no pending', async () => {
    saySdk.pending.list.mockResolvedValueOnce([]);
    expect(await service.sync('u1')).toEqual({ created: 0, consumed: 0 });
  });
});
