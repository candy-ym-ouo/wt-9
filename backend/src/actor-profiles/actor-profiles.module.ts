import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActorProfilesController } from './actor-profiles.controller';
import { ActorProfilesService } from './actor-profiles.service';
import {
  ActorProfile,
  RehearsalAvailability,
  RehearsalAvailabilityException,
  HistoricalRole,
  User,
  Material,
  LeaveRequest,
  CastRole,
} from '../entities';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActorProfile,
      RehearsalAvailability,
      RehearsalAvailabilityException,
      HistoricalRole,
      User,
      Material,
      LeaveRequest,
      CastRole,
    ]),
    AuditLogsModule,
  ],
  controllers: [ActorProfilesController],
  providers: [ActorProfilesService],
  exports: [ActorProfilesService],
})
export class ActorProfilesModule {}
