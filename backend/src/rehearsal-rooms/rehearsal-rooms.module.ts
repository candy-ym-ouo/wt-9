import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RehearsalRoom, RoomReservation } from '../entities';
import { RehearsalRoomsService } from './rehearsal-rooms.service';
import { RehearsalRoomsController } from './rehearsal-rooms.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([RehearsalRoom, RoomReservation]), AuditLogsModule],
  providers: [RehearsalRoomsService],
  controllers: [RehearsalRoomsController],
  exports: [RehearsalRoomsService],
})
export class RehearsalRoomsModule {}
