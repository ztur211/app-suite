import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { MealsService, type CreateMealData, type UpdateMealData } from './meals.service';

@Controller('meals')
@UseGuards(SessionGuard)
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  list(@Req() req: Request & { userId: string }) {
    return this.meals.list(req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() body: CreateMealData) {
    return this.meals.create(req.userId, body);
  }

  @Patch(':id')
  patch(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: UpdateMealData,
  ) {
    return this.meals.update(req.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.meals.remove(req.userId, id);
  }
}
