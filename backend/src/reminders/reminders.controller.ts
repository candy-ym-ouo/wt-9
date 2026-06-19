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
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UserRole,
  ReminderStatus,
  ReminderType,
  ReminderChannel,
} from '../entities';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private service: RemindersService) {}

  @Get('summary')
  async getSummary(@Request() req: any) {
    return this.service.getReminderSummary(req.user.userId, req.user.role);
  }

  @Get('today-tasks')
  async getTodayTasks(@Request() req: any) {
    return this.service.generateTodayTasks(req.user.userId, req.user.role);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.service.getUnreadCount(req.user.userId);
    return { count };
  }

  @Get('upcoming')
  async getUpcomingRehearsals(
    @Request() req: any,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.service.getUpcomingRehearsals(req.user.userId, req.user.role, daysNum);
  }

  @Get('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getConfigs() {
    return this.service.getConfigs();
  }

  @Get('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async getConfig(@Param('id') id: string) {
    const config = await this.service.getConfig(parseInt(id, 10));
    if (!config) {
      throw new HttpException('配置不存在', HttpStatus.NOT_FOUND);
    }
    return config;
  }

  @Get()
  async getReminders(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const options: any = {};
    if (status && Object.values(ReminderStatus).includes(status as ReminderStatus)) {
      options.status = status as ReminderStatus;
    }
    if (type && Object.values(ReminderType).includes(type as ReminderType)) {
      options.type = type as ReminderType;
    }
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);

    return this.service.getUserReminders(req.user.userId, options);
  }

  @Get(':id')
  async getReminder(@Param('id') id: string, @Request() req: any) {
    const reminderId = parseInt(id, 10);
    if (isNaN(reminderId)) {
      throw new HttpException('无效的提醒ID', HttpStatus.BAD_REQUEST);
    }
    const { items } = await this.service.getUserReminders(req.user.userId, {});
    const reminder = items.find((r) => r.id === reminderId);
    if (!reminder) {
      throw new HttpException('提醒不存在', HttpStatus.NOT_FOUND);
    }
    return reminder;
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    const count = await this.service.markAllAsRead(req.user.userId);
    return { updated: count };
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markAsRead(parseInt(id, 10), req.user.userId);
  }

  @Put(':id/dismiss')
  async dismissReminder(@Param('id') id: string, @Request() req: any) {
    return this.service.dismissReminder(parseInt(id, 10), req.user.userId);
  }

  @Post('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async createConfig(
    @Body()
    body: {
      type: ReminderType;
      targetRoles: UserRole[];
      channels?: ReminderChannel[];
      enabled?: boolean;
      advanceMinutes?: number;
      template?: string;
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.createConfig(body, req.user.userId);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async updateConfig(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      type: ReminderType;
      targetRoles: UserRole[];
      channels: ReminderChannel[];
      enabled: boolean;
      advanceMinutes: number;
      template: string;
    }>,
  ) {
    try {
      return await this.service.updateConfig(parseInt(id, 10), body);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async deleteConfig(@Param('id') id: string) {
    try {
      await this.service.deleteConfig(parseInt(id, 10));
      return { success: true };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async createReminder(
    @Body()
    body: {
      userId: number;
      type: ReminderType;
      channel?: ReminderChannel;
      title: string;
      message: string;
      metadata?: Record<string, any>;
      rehearsalId?: number;
      materialId?: number;
    },
  ) {
    try {
      return await this.service.createReminder({
        ...body,
        channel: body.channel || ReminderChannel.IN_APP,
      });
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('generate-daily')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async generateDailyReminders() {
    const count = await this.service.generateDailyReminders();
    return { generated: count };
  }

  @Post('init-defaults')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async initDefaultConfigs(@Request() req: any) {
    return this.service.initializeDefaultConfigs(req.user.userId);
  }
}
