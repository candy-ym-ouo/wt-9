import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { SubscriptionsService, CreateSubscriptionDto, SubscriptionsQueryOptions,
} from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SubscriptionTargetType,
  SubscriptionType,
} from '../entities';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  @Post()
  create(@Body() dto: CreateSubscriptionDto, @Request() req: any) {
    return this.service.create(dto, req.user.userId, req.user.username || req.user.displayName || '用户');
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username || req.user.displayName || '用户');
  }

  @Delete('target/:targetType/:targetId')
  removeByTarget(
    @Param('targetType') targetType: SubscriptionTargetType,
    @Param('targetId') targetId: number,
    @Request() req: any,
  ) {
    return this.service.removeByTarget(
      targetType,
      targetId,
      req.user.userId,
      req.user.username || req.user.displayName || '用户',
    );
  }

  @Get()
  findByUser(
    @Query() query: SubscriptionsQueryOptions,
    @Request() req: any,
  ) {
    return this.service.findByUser(req.user.userId, query);
  }

  @Get('favorites')
  findFavorites(
    @Query('targetType') targetType: SubscriptionTargetType,
    @Request() req: any,
  ) {
    return this.service.findFavorites(req.user.userId, targetType);
  }

  @Get('subscribes')
  findSubscriptions(
    @Query('targetType') targetType: SubscriptionTargetType,
    @Request() req: any,
  ) {
    return this.service.findSubscriptions(req.user.userId, targetType);
  }

  @Get('stats')
  getUserStats(@Request() req: any) {
    return this.service.getUserStats(req.user.userId);
  }

  @Get('check/:targetType/:targetId')
  checkStatus(
    @Param('targetType') targetType: SubscriptionTargetType,
    @Param('targetId') targetId: number,
    @Request() req: any,
  ) {
    return this.service.checkStatus(req.user.userId, targetType, targetId);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  @Get('target/:targetType/:targetId/subscribers')
  getSubscribers(
    @Param('targetType') targetType: SubscriptionTargetType,
    @Param('targetId') targetId: number,
  ) {
    return this.service.getSubscribers(targetType, targetId);
  }
}
