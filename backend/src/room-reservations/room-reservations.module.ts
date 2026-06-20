import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomReservation, RehearsalRoom, Equipment, User } from '../entities';
import { RoomReservationsService } from './room-reservations.service';
import { RoomReservationsController } from './room-reservations.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoomReservation, RehearsalRoom, Equipment, User]),
    AuditLogsModule,
  ],
  providers: [RoomReservationsService],
  controllers: [RoomReservationsController],
  exports: [RoomReservationsService],
})
export class RoomReservationsModule {}
