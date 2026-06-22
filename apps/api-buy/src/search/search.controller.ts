import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { SearchService } from './search.service';

interface SearchBody {
  query: string;
  limit?: number;
}

@Controller('items')
@UseGuards(SessionGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** POST /items/search — find external products to add to the list. */
  @Post('search')
  run(@Body() body: SearchBody) {
    return this.search.search(body?.query ?? '', body?.limit);
  }
}
