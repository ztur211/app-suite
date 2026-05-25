import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { ItemsService, type CreateItemData, type UpdateItemData } from './items.service';

@Controller('items')
@UseGuards(SessionGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(@Req() req: Request & { userId: string }) {
    return this.items.list(req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() body: CreateItemData) {
    return this.items.create(req.userId, body);
  }

  @Patch(':id')
  patch(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: UpdateItemData,
  ) {
    return this.items.update(req.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.items.remove(req.userId, id);
  }
}
