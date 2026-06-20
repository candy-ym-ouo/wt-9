import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Subscription,
  User,
  Rehearsal,
  CastRole,
  Annotation,
  Material,
} from '../entities';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      User,
      Rehearsal,
      CastRole,
      Annotation,
      Material,
    ]),
    NotificationsModule,
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
  ],
  providers: [SubscriptionsService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
