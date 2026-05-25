import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ServiceJwtGuard } from './service-jwt.guard';
import { PendingService, type PendingDestination } from './pending.service';

@Controller('pending')
@UseGuards(new ServiceJwtGuard(['api-buy', 'api-eat']))
export class PendingController {
  constructor(private readonly svc: PendingService) {}

  @Get()
  list(
    @Req() req: Request & { userId: string },
    @Query('destination') destination: PendingDestination,
  ) {
    return this.svc.list(req.userId, destination);
  }

  @Post(':id/consume')
  consume(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: { destinationRef: string },
  ) {
    return this.svc.consume(id, req.userId, body.destinationRef);
  }
}
