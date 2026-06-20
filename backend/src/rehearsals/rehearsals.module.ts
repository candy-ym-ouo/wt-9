import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal, User, CastRole, LeaveRequest, Material } from '../entities';
import { RehearsalsService } from './rehearsals.service';
import { RehearsalsController } from './rehearsals.controller';
import { LeavesModule } from '../leaves/leaves.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DramasModule } from '../dramas/dramas.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rehearsal, User, CastRole, LeaveRequest, Material]),
    LeavesModule,
    forwardRef(() => AuditLogsModule),
    NotificationsModule,
    forwardRef(() => DramasModule),
    forwardRef(() => TagsModule),
  ],
  providers: [RehearsalsService],
  controllers: [RehearsalsController],
  exports: [RehearsalsService],
})
export class RehearsalsModule {}
