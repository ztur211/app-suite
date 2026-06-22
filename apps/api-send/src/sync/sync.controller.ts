import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(SessionGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** POST /sync — pull SEND intents parked in api-say into email drafts. */
  @Post()
  run(@Req() req: Request & { userId: string }) {
    return this.sync.sync(req.userId);
  }
}
