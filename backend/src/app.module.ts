import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { User, Rehearsal, CastRole, Annotation, AnnotationVersion, Material, LeaveRequest, Reminder, ReminderConfig } from './entities';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';
import { RolesModule } from './roles/roles.module';
import { AnnotationsModule } from './annotations/annotations.module';
import { MaterialsModule } from './materials/materials.module';
import { SearchModule } from './search/search.module';
import { LeavesModule } from './leaves/leaves.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: join(process.cwd(), 'theater.db'),
      autoSave: true,
      entities: [User, Rehearsal, CastRole, Annotation, AnnotationVersion, Material, LeaveRequest, Reminder, ReminderConfig],
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
  ],
})
export class AppModule {}
