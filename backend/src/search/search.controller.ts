import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private service: SearchService) {}

  @Get()
  search(@Query('q') query: string) {
    if (!query || query.trim().length === 0) {
      return { rehearsals: [], roles: [], annotations: [], materials: [], total: 0 };
    }
    return this.service.search(query.trim());
  }
}
