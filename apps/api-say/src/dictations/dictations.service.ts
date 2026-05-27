import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DateTime } from 'luxon';
import type { ZodSchema } from 'zod';
import {
  intentResult,
  taskPayload,
  notePayload,
  emailPayload,
  shoppingPayload,
  mealPayload,
  type Intent,
  type IntentResult,
} from '@things/types';
import { AiClient, type Usage } from '@things/ai';
import { Prisma, type Dictation, CaptureMode } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { intentToDestination } from '../dispatch/intent-destination';
import { INTENT_CLASSIFY_PROMPT } from '../ai/prompts/intent-classify-prompt';
import { RESHAPE_PROMPT_BY_INTENT } from '../ai/prompts/reshape-prompts';

export interface CreateInput {
  idempotencyKey: string;
  userId: string;
  userTimezone: string;
  previewTranscript?: string;
  captureMode: CaptureMode;
  /** Required for 'tap'/'drive'; ignored for 'type' (uses previewTranscript). */
  audioBuffer?: Buffer;
}

export type DictationView = Dictation;

const PAYLOAD_SCHEMA_BY_INTENT = {
  DO: taskPayload,
  NOTE: notePayload,
  SEND: emailPayload,
  BUY: shoppingPayload,
  EAT: mealPayload,
} as const;

@Injectable()
export class DictationsService {
  private readonly log = new Logger(DictationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClient,
    private readonly dispatchSvc: DispatchService,
    @Inject('TMP_AUDIO_DIR') private readonly tmpDir: string,
  ) {}

  async create(input: CreateInput): Promise<{ dictation: DictationView; proposal: IntentResult }> {
    const id = input.idempotencyKey;
    const isTyped = input.captureMode === 'type';

    if (isTyped) {
      if (!input.previewTranscript || input.previewTranscript.trim() === '') {
        throw new BadRequestException("previewTranscript is required for captureMode 'type'");
      }
    } else {
      if (!input.audioBuffer) {
        throw new BadRequestException(
          `audio file is required for captureMode '${input.captureMode}'`,
        );
      }
    }

    const audioPath = isTyped ? null : path.join(this.tmpDir, `${id}.webm`);
    if (audioPath && input.audioBuffer) {
      await fs.mkdir(this.tmpDir, { recursive: true });
      await fs.writeFile(audioPath, input.audioBuffer);
    }

    try {
      const trans = isTyped
        ? {
            text: input.previewTranscript ?? '',
            language: 'en',
            usage: { kind: 'audio' as const, seconds: 0 },
          }
        : await this.ai.transcribe(input.audioBuffer as Buffer);
      const nowLocal = DateTime.now().setZone(input.userTimezone).toISO();

      let proposal: IntentResult;
      let classifyUsage: Usage;
      try {
        const r = await this.ai.chatStructured(
          intentResult,
          [
            { role: 'system', content: INTENT_CLASSIFY_PROMPT },
            {
              role: 'user',
              content:
                `Current user timezone: ${input.userTimezone}\n` +
                `Current user local time: ${nowLocal}\n` +
                `captureMode: ${input.captureMode}\n\n` +
                `Transcript: """${trans.text}"""`,
            },
          ],
          { cacheSystem: true, context: { userId: input.userId, callerApp: 'api-say' } },
        );
        proposal = r.value;
        classifyUsage = r.usage;
      } catch (err) {
        this.log.warn(`intentResult failed (${(err as Error).message}); falling back to NOTE`);
        proposal = {
          intent: 'NOTE',
          payload: { body: trans.text },
          confidence: 0,
        };
        classifyUsage = { kind: 'tokens', inputTokens: 0, outputTokens: 0 };
      }

      const dictation = await this.prisma.dictation.create({
        data: {
          id,
          userId: input.userId,
          previewTranscript: input.previewTranscript ?? null,
          finalTranscript: trans.text,
          language: trans.language,
          captureMode: input.captureMode,
          intent: proposal.intent,
          confidence: proposal.confidence,
          proposedPayload: proposal.payload,
          destination: intentToDestination[proposal.intent],
          usage: { transcribe: trans.usage, classify: classifyUsage } as Prisma.InputJsonValue,
        },
      });

      return { dictation, proposal };
    } finally {
      if (audioPath) await fs.unlink(audioPath).catch(() => undefined);
    }
  }

  private async getOwned(id: string, userId: string): Promise<Dictation> {
    const d = await this.prisma.dictation.findUnique({ where: { id } });
    if (!d || d.userId !== userId) throw new NotFoundException();
    return d;
  }

  async dispatch(
    id: string,
    userId: string,
  ): Promise<{ dictation: DictationView; renderedEmail?: string }> {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'proposed') {
      throw new BadRequestException(`Cannot dispatch in state=${d.state}`);
    }
    const effective = (d.editedPayload ?? d.proposedPayload) as Prisma.JsonObject;
    const out = await this.dispatchSvc.dispatch({
      intent: d.intent,
      dictationId: d.id,
      userId,
      payload: effective as never,
    });
    const dictation = await this.prisma.dictation.update({
      where: { id },
      data: {
        state: 'dispatched',
        destinationRef: out.destinationRef,
        dispatchedAt: new Date(),
      },
    });
    return { dictation, renderedEmail: out.renderedEmail };
  }

  async undoDispatch(id: string, userId: string): Promise<DictationView> {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'dispatched') {
      throw new BadRequestException(`Cannot undo in state=${d.state}`);
    }
    await this.dispatchSvc.undo({
      intent: d.intent,
      userId,
      destinationRef: d.destinationRef,
    });
    return this.prisma.dictation.update({
      where: { id },
      data: { state: 'proposed', destinationRef: null, dispatchedAt: null },
    });
  }

  async reclassify(
    id: string,
    userId: string,
    forceIntent: Intent,
    userTimezone: string,
  ): Promise<{ dictation: DictationView; proposal: IntentResult }> {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'proposed') {
      throw new BadRequestException(`Cannot reclassify in state=${d.state}`);
    }

    const nowLocal = DateTime.now().setZone(userTimezone).toISO();
    // Union of payload schemas isn't narrowable by TS at compile time; safe
    // because forceIntent indexes into a const-keyed map.
    const schema = PAYLOAD_SCHEMA_BY_INTENT[forceIntent] as unknown as ZodSchema<unknown>;
    const r = await this.ai.chatStructured(
      schema,
      [
        { role: 'system', content: RESHAPE_PROMPT_BY_INTENT[forceIntent] },
        {
          role: 'user',
          content:
            `Transcript: """${d.finalTranscript}"""\n` +
            `User timezone: ${userTimezone}\n` +
            `Current user local time: ${nowLocal}`,
        },
      ],
      { cacheSystem: true, context: { userId, callerApp: 'api-say' } },
    );

    const dictation = await this.prisma.dictation.update({
      where: { id },
      data: {
        intent: forceIntent,
        proposedPayload: r.value as Prisma.InputJsonValue,
        destination: intentToDestination[forceIntent],
        editedPayload: Prisma.DbNull,
        confidence: 1.0,
      },
    });

    return {
      dictation,
      proposal: { intent: forceIntent, payload: r.value, confidence: 1.0 } as IntentResult,
    };
  }

  async patchEdit(id: string, userId: string, editedPayload: unknown): Promise<DictationView> {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'proposed') {
      throw new BadRequestException(`Cannot edit in state=${d.state}`);
    }
    return this.prisma.dictation.update({
      where: { id },
      data: { editedPayload: editedPayload as Prisma.InputJsonValue },
    });
  }

  async list(
    userId: string,
    opts: { intent?: Intent; limit?: number } = {},
  ): Promise<DictationView[]> {
    return this.prisma.dictation.findMany({
      where: { userId, ...(opts.intent ? { intent: opts.intent } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.prisma.dictation.delete({ where: { id } });
  }
}
