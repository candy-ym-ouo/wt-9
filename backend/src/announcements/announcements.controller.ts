import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UserRole,
  AnnouncementCategory,
  AnnouncementStatus,
} from '../entities';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private service: AnnouncementsService) {}

  @Get()
  findAll(
    @Query('category') category?: AnnouncementCategory,
    @Query('status') status?: AnnouncementStatus,
    @Query('keyword') keyword?: string,
    @Query('tags') tags?: string,
    @Query('createdBy') createdBy?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    const userRole = req?.user?.role;
    const isAdminOrDirector =
      userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR;

    return this.service.findAll({
      category,
      status: status || (!isAdminOrDirector ? AnnouncementStatus.PUBLISHED : undefined),
      keyword,
      tags,
      createdBy: createdBy !== undefined ? parseInt(createdBy, 10) : undefined,
      dateFrom,
      dateTo,
      userRole: isAdminOrDirector ? undefined : userRole,
    });
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getStats() {
    return this.service.getStats();
  }

  @Get('meta/categories')
  getCategories() {
    return [
      { value: AnnouncementCategory.GENERAL, label: '通用公告' },
      { value: AnnouncementCategory.REHEARSAL, label: '排练通知' },
      { value: AnnouncementCategory.PERFORMANCE, label: '演出公告' },
      { value: AnnouncementCategory.ADMIN, label: '行政通知' },
      { value: AnnouncementCategory.IMPORTANT, label: '重要公告' },
    ];
  }

  @Get('meta/statuses')
  getStatuses() {
    return [
      { value: AnnouncementStatus.DRAFT, label: '草稿' },
      { value: AnnouncementStatus.PUBLISHED, label: '已发布' },
      { value: AnnouncementStatus.ARCHIVED, label: '已归档' },
    ];
  }

  @Get('meta/roles')
  getVisibleRoles() {
    return [
      { value: UserRole.ADMIN, label: '管理员' },
      { value: UserRole.DIRECTOR, label: '导演' },
      { value: UserRole.ACTOR, label: '演员' },
      { value: UserRole.VIEWER, label: '观众' },
    ];
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id, true);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  create(
    @Body()
    body: {
      title: string;
      content?: string;
      category?: AnnouncementCategory;
      status?: AnnouncementStatus;
      visibleRoles?: UserRole[];
      isPinned?: boolean;
      pinExpiresAt?: string;
      attachmentIds?: number[];
      tags?: string[];
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        pinExpiresAt: body.pinExpiresAt ? new Date(body.pinExpiresAt) : null,
        visibleRoles: body.visibleRoles || [],
        attachmentIds: body.attachmentIds || [],
        tags: body.tags || [],
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(
    @Param('id') id: number,
    @Body()
    body: {
      title?: string;
      content?: string;
      category?: AnnouncementCategory;
      status?: AnnouncementStatus;
      visibleRoles?: UserRole[];
      isPinned?: boolean;
      pinExpiresAt?: string | null;
      attachmentIds?: number[];
      tags?: string[];
    },
    @Request() req: any,
  ) {
    const { pinExpiresAt, ...rest } = body;
    return this.service.update(
      id,
      {
        ...rest,
        pinExpiresAt:
          pinExpiresAt === undefined
            ? undefined
            : pinExpiresAt === null
            ? null
            : new Date(pinExpiresAt),
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }

  @Put(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  publish(@Param('id') id: number, @Request() req: any) {
    return this.service.publish(id, req.user.userId, req.user.username);
  }

  @Put(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  archive(@Param('id') id: number, @Request() req: any) {
    return this.service.archive(id, req.user.userId, req.user.username);
  }

  @Put(':id/pin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  pin(
    @Param('id') id: number,
    @Body() body: { pinExpiresAt?: string | null },
    @Request() req: any,
  ) {
    const pinExpiresAt =
      body.pinExpiresAt === undefined || body.pinExpiresAt === null
        ? null
        : new Date(body.pinExpiresAt);
    return this.service.pin(id, pinExpiresAt, req.user.userId, req.user.username);
  }

  @Put(':id/unpin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  unpin(@Param('id') id: number, @Request() req: any) {
    return this.service.unpin(id, req.user.userId, req.user.username);
  }
}
