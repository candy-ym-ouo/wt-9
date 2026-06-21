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
import { PerformanceReviewsService } from './performance-reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UserRole,
  PerformanceReviewType,
  PerformanceReviewStatus,
  PerformanceReviewPriority,
  PerformanceReviewSeverity,
} from '../entities';

@Controller('performance-reviews')
@UseGuards(JwtAuthGuard)
export class PerformanceReviewsController {
  constructor(private service: PerformanceReviewsService) {}

  @Get()
  findAll(
    @Query('type') type?: PerformanceReviewType,
    @Query('status') status?: PerformanceReviewStatus,
    @Query('priority') priority?: PerformanceReviewPriority,
    @Query('severity') severity?: PerformanceReviewSeverity,
    @Query('performanceId') performanceId?: string,
    @Query('dramaId') dramaId?: string,
    @Query('roleId') roleId?: string,
    @Query('materialId') materialId?: string,
    @Query('actorId') actorId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('reporterId') reporterId?: string,
    @Query('createdBy') createdBy?: string,
    @Query('keyword') keyword?: string,
    @Query('tags') tags?: string,
    @Query('category') category?: string,
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
    @Query('createdAtFrom') createdAtFrom?: string,
    @Query('createdAtTo') createdAtTo?: string,
  ) {
    return this.service.findAll({
      type,
      status,
      priority,
      severity,
      performanceId: performanceId ? parseInt(performanceId, 10) : undefined,
      dramaId: dramaId ? parseInt(dramaId, 10) : undefined,
      roleId: roleId ? parseInt(roleId, 10) : undefined,
      materialId: materialId ? parseInt(materialId, 10) : undefined,
      actorId: actorId ? parseInt(actorId, 10) : undefined,
      assigneeId: assigneeId ? parseInt(assigneeId, 10) : undefined,
      reporterId: reporterId ? parseInt(reporterId, 10) : undefined,
      createdBy: createdBy ? parseInt(createdBy, 10) : undefined,
      keyword,
      tags,
      category,
      dueFrom,
      dueTo,
      createdAtFrom,
      createdAtTo,
    });
  }

  @Get('stats')
  getStats(
    @Query('type') type?: PerformanceReviewType,
    @Query('status') status?: PerformanceReviewStatus,
    @Query('priority') priority?: PerformanceReviewPriority,
    @Query('severity') severity?: PerformanceReviewSeverity,
    @Query('performanceId') performanceId?: string,
    @Query('dramaId') dramaId?: string,
    @Query('keyword') keyword?: string,
    @Query('tags') tags?: string,
    @Query('category') category?: string,
  ) {
    return this.service.getStats({
      type,
      status,
      priority,
      severity,
      performanceId: performanceId ? parseInt(performanceId, 10) : undefined,
      dramaId: dramaId ? parseInt(dramaId, 10) : undefined,
      keyword,
      tags,
      category,
    });
  }

  @Get('meta/tags')
  getAllTags() {
    return this.service.getAllTags();
  }

  @Get('meta/categories')
  getAllCategories() {
    return this.service.getAllCategories();
  }

  @Get('performance/:performanceId')
  getByPerformance(@Param('performanceId') performanceId: string) {
    return this.service.getByPerformance(parseInt(performanceId, 10));
  }

  @Get('drama/:dramaId')
  getByDrama(@Param('dramaId') dramaId: string) {
    return this.service.getByDrama(parseInt(dramaId, 10));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(parseInt(id, 10));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async create(
    @Body()
    body: {
      type: PerformanceReviewType;
      title: string;
      description?: string;
      status?: PerformanceReviewStatus;
      priority?: PerformanceReviewPriority;
      severity?: PerformanceReviewSeverity;
      performanceId?: number;
      dramaId?: number;
      relatedRoleIds?: number[];
      relatedMaterialIds?: number[];
      relatedActorIds?: number[];
      relatedTaskIds?: number[];
      assigneeId?: number;
      reporterId?: number;
      followerIds?: number[];
      dueDate?: string;
      resolution?: string;
      tags?: string[];
      category?: string;
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.create(
        {
          ...body,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          tags: body.tags || [],
          relatedRoleIds: body.relatedRoleIds || [],
          relatedMaterialIds: body.relatedMaterialIds || [],
          relatedActorIds: body.relatedActorIds || [],
          relatedTaskIds: body.relatedTaskIds || [],
          followerIds: body.followerIds || [],
        },
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      type: PerformanceReviewType;
      title: string;
      description: string;
      status: PerformanceReviewStatus;
      priority: PerformanceReviewPriority;
      severity: PerformanceReviewSeverity;
      performanceId: number;
      dramaId: number;
      relatedRoleIds: number[];
      relatedMaterialIds: number[];
      relatedActorIds: number[];
      relatedTaskIds: number[];
      assigneeId: number;
      reporterId: number;
      followerIds: number[];
      dueDate: string;
      resolution: string;
      tags: string[];
      category: string;
    }>,
    @Request() req: any,
  ) {
    try {
      const data: any = { ...body };
      if (body.dueDate) data.dueDate = new Date(body.dueDate);
      return await this.service.update(
        parseInt(id, 10),
        data,
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: PerformanceReviewStatus; remark?: string },
    @Request() req: any,
  ) {
    return this.service.updateStatus(
      parseInt(id, 10),
      body.status,
      req.user.userId,
      req.user.username,
      body.remark,
    );
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.service.addComment(
      parseInt(id, 10),
      body.content,
      req.user.userId,
      req.user.username,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(
      parseInt(id, 10),
      req.user.userId,
      req.user.username,
    );
  }
}
