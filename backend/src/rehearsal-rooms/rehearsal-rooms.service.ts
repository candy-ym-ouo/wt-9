import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { RehearsalRoom, RoomStatus, AuditAction, AuditModule } from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RoomReservation, ReservationStatus } from '../entities/room-reservation.entity';

@Injectable()
export class RehearsalRoomsService {
  constructor(
    @InjectRepository(RehearsalRoom)
    private repo: Repository<RehearsalRoom>,
    @InjectRepository(RoomReservation)
    private reservationRepo: Repository<RoomReservation>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(data: Partial<RehearsalRoom>, operatorId: number, operatorName: string) {
    const item = this.repo.create(data);
    const saved = await this.repo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_REHEARSAL_ROOM,
      module: AuditModule.REHEARSAL_ROOM,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'rehearsal_room',
      detail: `创建排练室「${saved.name}」`,
      metadata: { name: saved.name, capacity: saved.capacity },
    });

    return this.findOne(saved.id);
  }

  async findAll(status?: RoomStatus) {
    const where = status ? { status } : {};
    return this.repo.find({ where, order: { id: 'ASC' } });
  }

  async findOne(id: number) {
    const room = await this.repo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('排练室不存在');
    return room;
  }

  async findOneWithDetails(id: number) {
    const room = await this.findOne(id);
    const activeReservations = await this.reservationRepo.find({
      where: {
        roomId: id,
        status: ReservationStatus.CONFIRMED,
      },
      order: { startTime: 'ASC' },
    });
    return { ...room, activeReservations };
  }

  async getAvailableRooms(startTime: Date, endTime: Date, capacity?: number) {
    const rooms = await this.repo.find({
      where: { status: RoomStatus.AVAILABLE },
      order: { capacity: 'ASC' },
    });

    const queryStart = new Date(startTime);
    const queryEnd = new Date(endTime);

    const overlappingReservations = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: ReservationStatus.CONFIRMED })
      .andWhere('r.startTime < :queryEnd', { queryEnd })
      .andWhere('r.endTime > :queryStart', { queryStart })
      .getMany();

    const conflictRoomIds = new Set<number>();
    for (const reservation of overlappingReservations) {
      conflictRoomIds.add(reservation.roomId);
    }

    let availableRooms = rooms.filter((r) => !conflictRoomIds.has(r.id));

    if (capacity) {
      availableRooms = availableRooms.filter((r) => r.capacity >= capacity);
    }

    return availableRooms;
  }

  private isTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  async update(id: number, data: Partial<RehearsalRoom>, operatorId: number, operatorName: string) {
    const oldRoom = await this.findOne(id);
    await this.repo.update(id, data);
    const updated = await this.findOne(id);

    const changes: string[] = [];
    if (data.name && data.name !== oldRoom.name) {
      changes.push(`名称: ${oldRoom.name} → ${data.name}`);
    }
    if (data.capacity !== undefined && data.capacity !== oldRoom.capacity) {
      changes.push(`容量: ${oldRoom.capacity} → ${data.capacity}`);
    }
    if (data.status && data.status !== oldRoom.status) {
      changes.push(`状态: ${oldRoom.status} → ${data.status}`);
    }
    if (data.area !== undefined && data.area !== oldRoom.area) {
      changes.push(`面积: ${oldRoom.area} → ${data.area}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_REHEARSAL_ROOM,
      module: AuditModule.REHEARSAL_ROOM,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'rehearsal_room',
      detail: changes.length > 0
        ? `更新排练室「${oldRoom.name}」: ${changes.join('; ')}`
        : `更新排练室「${oldRoom.name}」`,
      metadata: { old: oldRoom, new: data },
    });

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const room = await this.findOne(id);
    await this.repo.delete(id);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_REHEARSAL_ROOM,
      module: AuditModule.REHEARSAL_ROOM,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'rehearsal_room',
      detail: `删除排练室「${room.name}」`,
      metadata: { name: room.name },
    });

    return { success: true };
  }

  async getRoomUsageStats(roomId: number, startDate: Date, endDate: Date) {
    const queryStart = new Date(startDate);
    const queryEnd = new Date(endDate);

    const reservations = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.roomId = :roomId', { roomId })
      .andWhere('r.status = :status', { status: ReservationStatus.COMPLETED })
      .andWhere('r.startTime < :queryEnd', { queryEnd })
      .andWhere('r.endTime > :queryStart', { queryStart })
      .getMany();

    let totalHours = 0;
    const purposeStats: Record<string, number> = {};

    for (const r of reservations) {
      const rStart = new Date(r.startTime);
      const rEnd = new Date(r.endTime);
      const effectiveStart = rStart < queryStart ? queryStart : rStart;
      const effectiveEnd = rEnd > queryEnd ? queryEnd : rEnd;
      const hours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
      totalHours += hours;
      purposeStats[r.purpose] = (purposeStats[r.purpose] || 0) + hours;
    }

    return {
      roomId,
      totalReservations: reservations.length,
      totalHours: parseFloat(totalHours.toFixed(2)),
      purposeStats,
      avgParticipants: reservations.length > 0
        ? parseFloat((reservations.reduce((sum, r) => sum + r.participantCount, 0) / reservations.length).toFixed(1))
        : 0,
    };
  }
}
