import { SyncService } from '../sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SaySdk } from '@things/say-sdk';

describe('SyncService (unit)', () => {
  let prisma: { message: { findFirst: jest.Mock; create: jest.Mock } };
  let saySdk: { pending: { list: jest.Mock; consume: jest.Mock } };
  let service: SyncService;

  beforeEach(() => {
    prisma = { message: { findFirst: jest.fn(), create: jest.fn() } };
    saySdk = { pending: { list: jest.fn(), consume: jest.fn() } };
    service = new SyncService(prisma as unknown as PrismaService, saySdk as unknown as SaySdk);
  });

  it('creates an email draft from a PENDING_SEND item and consumes it', async () => {
    saySdk.pending.list.mockResolvedValueOnce([
      {
        dictationId: 'd1',
        createdAt: 'x',
        transcript: 't',
        payload: { subject: 'Hi', body: 'hello', recipientHint: 'Sarah' },
      },
    ]);
    prisma.message.findFirst.mockResolvedValueOnce(null);
    prisma.message.create.mockResolvedValueOnce({ id: 'm-new' });

    const r = await service.sync('u1');

    expect(saySdk.pending.list).toHaveBeenCalledWith({ userId: 'u1', destination: 'PENDING_SEND' });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        channel: 'email',
        kind: 'outbound',
        status: 'draft',
        subject: 'Hi',
        body: 'hello',
        recipient: 'Sarah',
        sourceDictationId: 'd1',
      },
    });
    expect(saySdk.pending.consume).toHaveBeenCalledWith('d1', {
      userId: 'u1',
      destinationRef: 'm-new',
    });
    expect(r).toEqual({ created: 1, consumed: 1 });
  });

  it('is idempotent: skips creation when a message already exists for the dictation', async () => {
    saySdk.pending.list.mockResolvedValueOnce([
      {
        dictationId: 'd1',
        createdAt: 'x',
        transcript: 't',
        payload: { subject: 'Hi', body: 'hello', recipientHint: null },
      },
    ]);
    prisma.message.findFirst.mockResolvedValueOnce({ id: 'existing' });

    const r = await service.sync('u1');

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(saySdk.pending.consume).toHaveBeenCalledWith('d1', {
      userId: 'u1',
      destinationRef: 'existing',
    });
    expect(r).toEqual({ created: 0, consumed: 1 });
  });

  it('returns zero counts when nothing is pending', async () => {
    saySdk.pending.list.mockResolvedValueOnce([]);
    const r = await service.sync('u1');
    expect(r).toEqual({ created: 0, consumed: 0 });
  });
});
