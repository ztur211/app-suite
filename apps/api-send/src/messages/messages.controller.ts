import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import {
  MessagesService,
  type CreateMessageData,
  type UpdateMessageData,
} from './messages.service';

@Controller('messages')
@UseGuards(SessionGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@Req() req: Request & { userId: string }) {
    return this.messages.list(req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() body: CreateMessageData) {
    return this.messages.create(req.userId, body);
  }

  @Patch(':id')
  patch(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: UpdateMessageData,
  ) {
    return this.messages.update(req.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.messages.remove(req.userId, id);
  }
}
