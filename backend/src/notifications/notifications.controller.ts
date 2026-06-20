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
import { NotificationsService, CreateNotificationDto } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  UserRole,
} from '../entities';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get('summary')
  async getSummary(@Request() req: any) {
    return this.service.getSummary(req.user.userId, req.user.role);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.service.getUnreadCount(req.user.userId);
    return { count };
  }

  @Get('types')
  getNotificationTypes() {
    return this.service.getNotificationTypes();
  }

  @Get('priorities')
  getNotificationPriorities() {
    return this.service.getNotificationPriorities();
  }

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const options: any = {};

    if (type && Object.values(NotificationType).includes(type as NotificationType)) {
      options.type = type as NotificationType;
    }
    if (status && Object.values(NotificationStatus).includes(status as NotificationStatus)) {
      options.status = status as NotificationStatus;
    }
    if (priority && Object.values(NotificationPriority).includes(priority as NotificationPriority)) {
      options.priority = priority as NotificationPriority;
    }
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);
    if (includeArchived === 'true') options.includeArchived = true;

    return this.service.getUserNotifications(req.user.userId, req.user.role, options);
  }

  @Get(':id')
  async getNotification(@Param('id') id: string, @Request() req: any) {
    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      throw new HttpException('无效的通知ID', HttpStatus.BAD_REQUEST);
    }

    const notification = await this.service.markAsRead(notificationId, req.user.userId);
    return notification;
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      throw new HttpException('无效的通知ID', HttpStatus.BAD_REQUEST);
    }

    return this.service.markAsRead(notificationId, req.user.userId);
  }

  @Put(':id/unread')
  async markAsUnread(@Param('id') id: string, @Request() req: any) {
    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      throw new HttpException('无效的通知ID', HttpStatus.BAD_REQUEST);
    }

    return this.service.markAsUnread(notificationId, req.user.userId);
  }

  @Put(':id/archive')
  async archive(@Param('id') id: string, @Request() req: any) {
    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      throw new HttpException('无效的通知ID', HttpStatus.BAD_REQUEST);
    }

    return this.service.archive(notificationId, req.user.userId);
  }

  @Put(':id/unarchive')
  async unarchive(@Param('id') id: string, @Request() req: any) {
    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      throw new HttpException('无效的通知ID', HttpStatus.BAD_REQUEST);
    }

    return this.service.unarchive(notificationId, req.user.userId);
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    const count = await this.service.markAllAsRead(req.user.userId);
    return { updated: count };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req: any) {
    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      throw new HttpException('无效的通知ID', HttpStatus.BAD_REQUEST);
    }

    await this.service.remove(notificationId, req.user.userId, req.user.role);
    return { success: true };
  }

  @Delete('clear-all')
  async clearAll(@Request() req: any) {
    const count = await this.service.deleteAllForUser(req.user.userId);
    return { deleted: count };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async createNotification(
    @Body()
    body: {
      type: NotificationType;
      title: string;
      message: string;
      priority?: NotificationPriority;
      metadata?: Record<string, any>;
      targetRoles?: UserRole[];
      targetUserIds?: number[];
      rehearsalId?: number;
      materialId?: number;
      annotationId?: number;
      expiresAt?: string;
    },
    @Request() req: any,
  ) {
    try {
      const dto: CreateNotificationDto = {
        ...body,
        senderId: req.user.userId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      };

      return await this.service.create(dto);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('announcement')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async createAnnouncement(
    @Body()
    body: {
      title: string;
      message: string;
      targetRoles?: UserRole[];
      priority?: NotificationPriority;
      expiresAt?: string;
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.createSystemAnnouncement(
        body.title,
        body.message,
        body.targetRoles,
        body.priority,
        req.user.userId,
        body.expiresAt ? new Date(body.expiresAt) : undefined,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('test/rehearsal/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async testRehearsalNotification(
    @Param('id') id: string,
    @Body() body: { action: 'created' | 'updated' | 'deleted' },
    @Request() req: any,
  ) {
    const rehearsalId = parseInt(id, 10);
    if (isNaN(rehearsalId)) {
      throw new HttpException('无效的排练ID', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.service.notifyRehearsalChange(
        rehearsalId,
        body.action,
        ['测试变更'],
        req.user.userId,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('test/material/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async testMaterialNotification(
    @Param('id') id: string,
    @Body() body: { action: 'created' | 'updated' | 'deleted' | 'new_version' },
    @Request() req: any,
  ) {
    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) {
      throw new HttpException('无效的素材ID', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.service.notifyMaterialUpdate(
        materialId,
        body.action,
        req.user.userId,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }
}
