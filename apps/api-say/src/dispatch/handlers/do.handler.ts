import { Injectable } from '@nestjs/common';
import { DoSdk } from '@things/do-sdk';
import type { TaskPayload } from '@things/types';

export interface DoDispatchInput {
  dictationId: string;
  userId: string;
  payload: TaskPayload;
}

export interface DoDispatchOutput {
  destinationRef: string;
}

@Injectable()
export class DoHandler {
  constructor(private readonly sdk: DoSdk) {}

  async dispatch(i: DoDispatchInput): Promise<DoDispatchOutput> {
    const task = await this.sdk.tasks.create({
      userId: i.userId,
      title: i.payload.title,
      dueAt: i.payload.dueAt,
      notes: i.payload.notes,
      source: { app: 'say-things', dictationId: i.dictationId },
    });
    return { destinationRef: task.id };
  }

  async undo(i: { userId: string; destinationRef: string }): Promise<void> {
    await this.sdk.tasks.delete({ userId: i.userId, taskId: i.destinationRef });
  }
}
