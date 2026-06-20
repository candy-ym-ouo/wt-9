import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private service: SearchService) {}

  @Get()
  search(
    @Query('q') query: string,
    @Query('modules') modules?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('dateField') dateField?: string,
    @Query('tags') tags?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('groupByModule') groupByModule?: string,
  ) {
    if ((!query || query.trim().length === 0) && !modules && !dateFrom && !dateTo && !tags) {
      return { rehearsals: [], roles: [], annotations: [], materials: [], performances: [], total: 0 };
    }
    return this.service.advancedSearch({
      query: query?.trim(),
      modules: modules ? modules.split(',') : undefined,
      dateFrom,
      dateTo,
      dateField: dateField as 'createdAt' | 'updatedAt' | 'startTime' | undefined,
      tags: tags ? tags.split(',') : undefined,
      sortBy: sortBy as 'date' | 'name' | 'relevance' | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      groupByModule: groupByModule !== 'false',
    });
  }

  @Get('meta/tags')
  getTags() {
    return this.service.getAllTags();
  }
}
