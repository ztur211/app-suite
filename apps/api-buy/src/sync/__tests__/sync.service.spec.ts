import { SaySdk, type PendingItem } from '@things/say-sdk';
import { SyncService } from '../sync.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SyncService (unit)', () => {
  let prisma: {
    shoppingItem: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };
  let saySdk: {
    pending: { list: jest.Mock; consume: jest.Mock };
  };
  let service: SyncService;

  beforeEach(() => {
    prisma = {
      shoppingItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    saySdk = {
      pending: { list: jest.fn(), consume: jest.fn() },
    };
    service = new SyncService(prisma as unknown as PrismaService, saySdk as unknown as SaySdk);
  });

  function makePending(overrides: Partial<PendingItem> = {}): PendingItem {
    return {
      dictationId: 'dict-1',
      createdAt: new Date().toISOString(),
      transcript: 'Buy milk',
      payload: { item: 'milk', quantity: 2, notes: 'whole' },
      ...overrides,
    };
  }

  it('inserts each pending item as a ShoppingItem and consumes it in Say', async () => {
    saySdk.pending.list.mockResolvedValueOnce([
      makePending({ dictationId: 'd1', payload: { item: 'eggs', quantity: 12, notes: undefined } }),
      makePending({
        dictationId: 'd2',
        payload: { item: 'bread', quantity: null, notes: 'sourdough' },
      }),
    ]);
    prisma.shoppingItem.findFirst.mockResolvedValue(null);
    prisma.shoppingItem.create
      .mockResolvedValueOnce({ id: 'i1', sourceDictationId: 'd1' })
      .mockResolvedValueOnce({ id: 'i2', sourceDictationId: 'd2' });
    saySdk.pending.consume.mockResolvedValue({ ok: true });

    const result = await service.sync('u1');

    expect(prisma.shoppingItem.create).toHaveBeenCalledTimes(2);
    expect(prisma.shoppingItem.create).toHaveBeenNthCalledWith(1, {
      data: {
        userId: 'u1',
        title: 'eggs',
        quantity: 12,
        notes: null,
        sourceDictationId: 'd1',
      },
    });
    expect(prisma.shoppingItem.create).toHaveBeenNthCalledWith(2, {
      data: {
        userId: 'u1',
        title: 'bread',
        quantity: null,
        notes: 'sourdough',
        sourceDictationId: 'd2',
      },
    });

    expect(saySdk.pending.consume).toHaveBeenCalledTimes(2);
    expect(saySdk.pending.consume).toHaveBeenNthCalledWith(1, 'd1', {
      userId: 'u1',
      destinationRef: 'i1',
    });
    expect(saySdk.pending.consume).toHaveBeenNthCalledWith(2, 'd2', {
      userId: 'u1',
      destinationRef: 'i2',
    });

    expect(result).toEqual({ created: 2, consumed: 2 });
  });

  it('skips create when item with sourceDictationId already exists, still consumes', async () => {
    saySdk.pending.list.mockResolvedValueOnce([makePending({ dictationId: 'd1' })]);
    prisma.shoppingItem.findFirst.mockResolvedValueOnce({
      id: 'pre-existing',
      sourceDictationId: 'd1',
    });
    saySdk.pending.consume.mockResolvedValueOnce({ ok: true });

    const result = await service.sync('u1');

    expect(prisma.shoppingItem.create).not.toHaveBeenCalled();
    expect(saySdk.pending.consume).toHaveBeenCalledWith('d1', {
      userId: 'u1',
      destinationRef: 'pre-existing',
    });
    expect(result).toEqual({ created: 0, consumed: 1 });
  });

  it('passes the right destination (PENDING_BUY) and userId to SaySdk', async () => {
    saySdk.pending.list.mockResolvedValueOnce([]);

    await service.sync('user-42');

    expect(saySdk.pending.list).toHaveBeenCalledWith({
      userId: 'user-42',
      destination: 'PENDING_BUY',
    });
  });

  it('returns { created: 0, consumed: 0 } when no pending items', async () => {
    saySdk.pending.list.mockResolvedValueOnce([]);
    const result = await service.sync('u1');
    expect(result).toEqual({ created: 0, consumed: 0 });
    expect(prisma.shoppingItem.create).not.toHaveBeenCalled();
    expect(saySdk.pending.consume).not.toHaveBeenCalled();
  });

  it('persists null quantity and null notes when payload omits them', async () => {
    saySdk.pending.list.mockResolvedValueOnce([
      makePending({
        dictationId: 'd1',
        payload: { item: 'salt', quantity: null, notes: undefined },
      }),
    ]);
    prisma.shoppingItem.findFirst.mockResolvedValueOnce(null);
    prisma.shoppingItem.create.mockResolvedValueOnce({ id: 'i1' });
    saySdk.pending.consume.mockResolvedValueOnce({ ok: true });

    await service.sync('u1');

    expect(prisma.shoppingItem.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        title: 'salt',
        quantity: null,
        notes: null,
        sourceDictationId: 'd1',
      },
    });
  });
});
