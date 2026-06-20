import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService, ReportsFilter } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getReports(@Query() filter: ReportsFilter) {
    return this.reportsService.getReports(filter);
  }

  @Get('filter-options')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getFilterOptions() {
    return this.reportsService.getFilterOptions();
  }
}
