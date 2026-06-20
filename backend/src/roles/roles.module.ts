import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CastRole, User, Rehearsal } from '../entities';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { LeavesModule } from '../leaves/leaves.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';
import { TagsModule } from '../tags/tags.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CastRole, User, Rehearsal]),
    LeavesModule,
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
    forwardRef(() => TagsModule),
    forwardRef(() => SubscriptionsModule),
    NotificationsModule,
  ],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
