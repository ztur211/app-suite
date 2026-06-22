import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { TelegramService } from './telegram.service';

/**
 * Message-scoped dispatch actions (outbound send + inbound sync). Lives under
 * the /messages path alongside the CRUD controller; routes are distinct
 * (POST /messages/:id/send, POST /messages/sync) so they don't collide.
 */
@Controller('messages')
@UseGuards(SessionGuard)
export class MessageDispatchController {
  constructor(private readonly telegram: TelegramService) {}

  /** POST /messages/:id/send — deliver an outbound Telegram message. */
  @Post(':id/send')
  send(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.telegram.send(req.userId, id);
  }

  /** POST /messages/sync — pull pending inbound Telegram updates. */
  @Post('sync')
  sync() {
    return this.telegram.syncInbound();
  }
}
