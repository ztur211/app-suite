import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AiClient } from '@things/ai';
import { DictationsService } from '../dictations.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { DispatchService } from '../../dispatch/dispatch.service';

class StubAi extends AiClient {
  transcribe = jest.fn();
  chat = jest.fn();
  chatStructured = jest.fn();
  summarize = jest.fn();
  embed = jest.fn();
  vision = jest.fn();
}

describe('DictationsService.create (integration)', () => {
  let prisma: PrismaService;
  let ai: StubAi;
  let dispatch: { dispatch: jest.Mock; undo: jest.Mock };
  let tmpDir: string;
  let svc: DictationsService;
  const userId = 'u-svc-int';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `svc-${Date.now()}@things-test.local`,
        emailVerified: true,
        timezone: 'Pacific/Auckland',
      },
    });
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'say-test-'));
  });

  beforeEach(async () => {
    await prisma.dictation.deleteMany({ where: { userId } });
    ai = new StubAi();
    dispatch = { dispatch: jest.fn(), undo: jest.fn() };
    svc = new DictationsService(prisma, ai, dispatch as unknown as DispatchService, tmpDir);
  });

  afterAll(async () => {
    await prisma.dictation.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('transcribes, classifies, persists Dictation with state=proposed, cleans up audio', async () => {
    ai.transcribe.mockResolvedValue({
      text: 'remind me to call mum',
      segments: [],
      language: 'en',
      usage: { kind: 'audio', seconds: 1.2 },
    });
    ai.chatStructured.mockResolvedValue({
      value: { intent: 'DO', payload: { title: 'Call mum', dueAt: null }, confidence: 0.9 },
      usage: { kind: 'tokens', inputTokens: 100, outputTokens: 20 },
    });

    const id = 'd-svc-int-1';
    const out = await svc.create({
      idempotencyKey: id,
      userId,
      userTimezone: 'Pacific/Auckland',
      previewTranscript: 'remind me to call mum',
      captureMode: 'tap',
      audioBuffer: Buffer.from('fake-audio'),
    });

    expect(ai.transcribe).toHaveBeenCalled();
    expect(ai.chatStructured).toHaveBeenCalled();
    expect(out.dictation.id).toBe(id);
    expect(out.dictation.state).toBe('proposed');
    expect(out.dictation.destination).toBe('DO_THINGS');
    expect(out.dictation.finalTranscript).toBe('remind me to call mum');
    expect(out.dictation.intent).toBe('DO');
    expect((out.dictation.proposedPayload as { title: string }).title).toBe('Call mum');
    expect(out.proposal.intent).toBe('DO');

    const persisted = await prisma.dictation.findUnique({ where: { id } });
    expect(persisted?.audioPath).toBeNull();
    expect(persisted?.state).toBe('proposed');
    // Audio file deleted
    expect(await fs.readdir(tmpDir)).not.toContain(`${id}.webm`);
  });

  it('cleans up audio file even on AI failure', async () => {
    ai.transcribe.mockRejectedValue(new Error('whisper down'));
    const id = 'd-svc-int-2';
    await expect(
      svc.create({
        idempotencyKey: id,
        userId,
        userTimezone: 'UTC',
        captureMode: 'tap',
        audioBuffer: Buffer.from('x'),
      }),
    ).rejects.toThrow();
    expect(await fs.readdir(tmpDir)).not.toContain(`${id}.webm`);
  });

  it('falls back to NOTE on chatStructured failure', async () => {
    ai.transcribe.mockResolvedValue({
      text: 'umm',
      segments: [],
      language: 'en',
      usage: { kind: 'audio', seconds: 0.3 },
    });
    ai.chatStructured.mockRejectedValue(new Error('schema parse failed twice'));

    const id = 'd-svc-int-3';
    const out = await svc.create({
      idempotencyKey: id,
      userId,
      userTimezone: 'UTC',
      captureMode: 'tap',
      audioBuffer: Buffer.from('x'),
    });

    expect(out.dictation.intent).toBe('NOTE');
    expect(out.dictation.confidence).toBe(0);
    expect((out.dictation.proposedPayload as { body: string }).body).toBe('umm');
  });
});
