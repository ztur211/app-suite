import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { TelegramService } from './telegram.service';

interface LinkBody {
  chatId: string;
}

@Controller('telegram')
@UseGuards(SessionGuard)
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  /** POST /telegram/link — connect the caller's account to a Telegram chat. */
  @Post('link')
  link(@Req() req: Request & { userId: string }, @Body() body: LinkBody) {
    return this.telegram.link(req.userId, body?.chatId ?? '');
  }
}
