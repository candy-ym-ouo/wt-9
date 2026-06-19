import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder, ReminderConfig, User, Rehearsal, CastRole, LeaveRequest } from '../entities';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RehearsalsModule } from '../rehearsals/rehearsals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder, ReminderConfig, User, Rehearsal, CastRole, LeaveRequest]),
    RehearsalsModule,
  ],
  providers: [RemindersService],
  controllers: [RemindersController],
  exports: [RemindersService],
})
export class RemindersModule {}
