import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(SessionGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Req() req: Request & { userId: string }) {
    return this.tasks.list(req.userId);
  }

  @Post()
  create(
    @Req() req: Request & { userId: string },
    @Body() body: { title: string; dueAt?: string },
  ) {
    return this.tasks.create(req.userId, body);
  }

  @Patch(':id')
  patch(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: { completed: boolean },
  ) {
    return this.tasks.setCompleted(req.userId, id, body.completed);
  }

  @Delete(':id')
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.tasks.remove(req.userId, id);
  }
}
