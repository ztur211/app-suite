import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { DiscoveryService, type DiscoveryKind } from './discovery.service';

interface SearchBody {
  query: string;
  kind?: DiscoveryKind;
  location?: string;
  limit?: number;
}

@Controller('meals')
@UseGuards(SessionGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  /** POST /meals/search — find recipes or restaurants to add to the list. */
  @Post('search')
  run(@Body() body: SearchBody) {
    return this.discovery.search(body?.query ?? '', body?.kind ?? 'recipe', {
      limit: body?.limit,
      location: body?.location,
    });
  }
}
