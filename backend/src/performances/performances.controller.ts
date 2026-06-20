import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PerformancesService } from './performances.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, PerformanceStatus, Performance } from '../entities';

@Controller('performances')
@UseGuards(JwtAuthGuard)
export class PerformancesController {
  constructor(private service: PerformancesService) {}

  @Get()
  async findAll(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('venue') venue?: string,
    @Query('theater') theater?: string,
    @Query('status') status?: PerformanceStatus,
    @Query('roleId') roleId?: string,
    @Query('keyword') keyword?: string,
    @Query('tags') tags?: string,
  ) {
    const hasFilters = venue || theater || status || roleId || keyword || tags;
    let performances: Performance[];
    if (hasFilters || (start && end)) {
      performances = await this.service.findWithFilters({
        start,
        end,
        venue,
        theater,
        status,
        roleId,
        keyword,
        tags,
      });
    } else {
      performances = await this.service.findAll();
    }
    const withConflicts = await this.service.enrichWithConflictInfo(performances);
    const withDetails = await this.service.enrichWithRoleAndMaterialInfo(performances);
    return withConflicts.map((p, i) => ({ ...p, ...withDetails[i] }));
  }

  @Get('meta/tags')
  getAllTags() {
    return this.service.getAllTags();
  }

  @Get('meta/venues')
  getAllVenues() {
    return this.service.getAllVenues();
  }

  @Get('meta/theaters')
  getAllTheaters() {
    return this.service.getAllTheaters();
  }

  @Get('date-range')
  async findByDateRange(@Query('start') start: string, @Query('end') end: string) {
    const performances = await this.service.findByDateRange(start, end);
    const withConflicts = await this.service.enrichWithConflictInfo(performances);
    const withDetails = await this.service.enrichWithRoleAndMaterialInfo(performances);
    return withConflicts.map((p, i) => ({ ...p, ...withDetails[i] }));
  }

  @Post('check-conflicts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  checkConflicts(
    @Body()
    body: {
      startTime: string;
      endTime: string;
      excludeId?: number;
      venue?: string;
      theater?: string;
    },
  ) {
    return this.service.checkConflicts(
      new Date(body.startTime),
      new Date(body.endTime),
      body.excludeId,
      body.venue,
      body.theater,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      venue?: string;
      theater?: string;
      status?: PerformanceStatus;
      roleIds?: number[];
      materialIds?: number[];
      castAssignments?: Record<number, {
        actorId?: number;
        substituteActorIds?: number[];
        notes?: string;
      }>;
      notes?: string;
      expectedAudience?: number;
      tags?: string[];
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.create(
        {
          ...body,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          createdBy: req.user.userId,
          roleIds: body.roleIds || [],
          materialIds: body.materialIds || [],
          tags: body.tags || [],
          castAssignments: body.castAssignments || {},
        },
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOneWithDetails(id);
  }

  @Get(':id/roles')
  getRoleDetails(@Param('id') id: number) {
    return this.service.getRoleDetails(id);
  }

  @Get(':id/materials')
  getMaterialDetails(@Param('id') id: number) {
    return this.service.getMaterialDetails(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async update(
    @Param('id') id: number,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      venue: string;
      theater: string;
      status: PerformanceStatus;
      roleIds: number[];
      materialIds: number[];
      castAssignments: Record<number, {
        actorId?: number;
        substituteActorIds?: number[];
        notes?: string;
      }>;
      notes: string;
      expectedAudience: number;
      tags: string[];
    }>,
    @Request() req: any,
  ) {
    try {
      const data: any = { ...body };
      if (body.startTime) data.startTime = new Date(body.startTime);
      if (body.endTime) data.endTime = new Date(body.endTime);
      return await this.service.update(id, data, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateStatus(
    @Param('id') id: number,
    @Body() body: { status: PerformanceStatus },
    @Request() req: any,
  ) {
    return this.service.updateStatus(id, body.status, req.user.userId, req.user.username);
  }

  @Post(':id/roles')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async bindRole(
    @Param('id') performanceId: number,
    @Body()
    body: {
      roleId: number;
      castAssignment?: {
        actorId?: number;
        substituteActorIds?: number[];
        notes?: string;
      };
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.bindRole(
        performanceId,
        body.roleId,
        body.castAssignment,
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id/roles/:roleId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  unbindRole(
    @Param('id') performanceId: number,
    @Param('roleId') roleId: number,
    @Request() req: any,
  ) {
    return this.service.unbindRole(performanceId, roleId, req.user.userId, req.user.username);
  }

  @Put(':id/roles/:roleId/cast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async updateRoleCast(
    @Param('id') performanceId: number,
    @Param('roleId') roleId: number,
    @Body()
    body: {
      actorId?: number;
      substituteActorIds?: number[];
      notes?: string;
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.updateRoleCast(
        performanceId,
        roleId,
        body,
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/materials')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async bindMaterial(
    @Param('id') performanceId: number,
    @Body() body: { materialId: number },
    @Request() req: any,
  ) {
    try {
      return await this.service.bindMaterial(
        performanceId,
        body.materialId,
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id/materials/:materialId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  unbindMaterial(
    @Param('id') performanceId: number,
    @Param('materialId') materialId: number,
    @Request() req: any,
  ) {
    return this.service.unbindMaterial(performanceId, materialId, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }
}
