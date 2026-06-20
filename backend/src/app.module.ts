import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import {
  User,
  Rehearsal,
  CastRole,
  Annotation,
  AnnotationVersion,
  Material,
  LeaveRequest,
  Reminder,
  ReminderConfig,
  Notification,
  AuditLog,
  Performance,
  Script,
  ScriptChapter,
  ScriptScene,
  ScriptVersion,
  ActorProfile,
  RehearsalAvailability,
  RehearsalAvailabilityException,
  HistoricalRole,
  Task,
} from './entities';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';
import { RolesModule } from './roles/roles.module';
import { AnnotationsModule } from './annotations/annotations.module';
import { MaterialsModule } from './materials/materials.module';
import { SearchModule } from './search/search.module';
import { LeavesModule } from './leaves/leaves.module';
import { RemindersModule } from './reminders/reminders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PerformancesModule } from './performances/performances.module';
import { ScriptsModule } from './scripts/scripts.module';
import { ActorProfilesModule } from './actor-profiles/actor-profiles.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: join(process.cwd(), 'theater.db'),
      autoSave: true,
      entities: [
        User,
        Rehearsal,
        CastRole,
        Annotation,
        AnnotationVersion,
        Material,
        LeaveRequest,
        Reminder,
        ReminderConfig,
        Notification,
        AuditLog,
        Performance,
        Script,
        ScriptChapter,
        ScriptScene,
        ScriptVersion,
        ActorProfile,
        RehearsalAvailability,
        RehearsalAvailabilityException,
        HistoricalRole,
        Task,
      ],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    RehearsalsModule,
    RolesModule,
    AnnotationsModule,
    MaterialsModule,
    SearchModule,
    LeavesModule,
    RemindersModule,
    NotificationsModule,
    AuditLogsModule,
    DashboardModule,
    PerformancesModule,
    ScriptsModule,
    ActorProfilesModule,
    TasksModule,
  ],
})
export class AppModule {}
