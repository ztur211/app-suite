import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { SessionOrServiceJwtGuard } from '../auth/session-or-service-jwt.guard';
import { TasksService, type UpdateTaskData } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @UseGuards(SessionGuard)
  list(@Req() req: Request & { userId: string }) {
    return this.tasks.list(req.userId);
  }

  @Post()
  @UseGuards(SessionOrServiceJwtGuard)
  create(
    @Req() req: Request & { userId: string },
    @Body()
    body: {
      title: string;
      dueAt?: string;
      /** Cross-app provenance (e.g. { app: 'say-things', dictationId: '…' }). */
      source?: { app: string; dictationId?: string; [k: string]: unknown };
    },
  ) {
    return this.tasks.create(req.userId, body);
  }

  @Patch(':id')
  @UseGuards(SessionGuard)
  patch(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: UpdateTaskData,
  ) {
    return this.tasks.update(req.userId, id, body);
  }

  @Delete(':id')
  @UseGuards(SessionOrServiceJwtGuard)
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.tasks.remove(req.userId, id);
  }
}
