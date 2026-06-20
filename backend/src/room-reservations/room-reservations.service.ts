import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, Brackets } from 'typeorm';
import {
  RoomReservation,
  ReservationStatus,
  ReservationPurpose,
  RehearsalRoom,
  RoomStatus,
  Equipment,
  EquipmentStatus,
  AuditAction,
  AuditModule,
  User,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface ConflictInfo {
  hasConflict: boolean;
  conflicts: Array<{
    type: 'room' | 'equipment' | 'capacity' | 'time_invalid';
    message: string;
    conflictingReservationId?: number;
  }>;
}

export interface CreateReservationParams {
  roomId: number;
  startTime: Date;
  endTime: Date;
  reserverName: string;
  reserverPhone?: string;
  purpose: ReservationPurpose;
  purposeDetail?: string;
  participantIds?: number[];
  participantCount?: number;
  equipmentIds?: number[];
  remarks?: string;
}

@Injectable()
export class RoomReservationsService {
  constructor(
    @InjectRepository(RoomReservation)
    private repo: Repository<RoomReservation>,
    @InjectRepository(RehearsalRoom)
    private roomRepo: Repository<RehearsalRoom>,
    @InjectRepository(Equipment)
    private equipmentRepo: Repository<Equipment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditLogsService: AuditLogsService,
  ) {}

  async checkConflicts(
    roomId: number,
    startTime: Date,
    endTime: Date,
    equipmentIds: number[] = [],
    participantCount: number = 0,
    excludeReservationId?: number,
  ): Promise<ConflictInfo> {
    const conflicts: ConflictInfo['conflicts'] = [];

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      conflicts.push({
        type: 'time_invalid',
        message: '开始时间必须早于结束时间',
      });
      return { hasConflict: true, conflicts };
    }

    if (start < new Date()) {
      conflicts.push({
        type: 'time_invalid',
        message: '预约时间不能早于当前时间',
      });
    }

    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      conflicts.push({
        type: 'room',
        message: '排练室不存在',
      });
      return { hasConflict: true, conflicts };
    }

    if (room.status !== RoomStatus.AVAILABLE) {
      conflicts.push({
        type: 'room',
        message: `排练室当前状态为「${room.status}」，不可预约`,
      });
    }

    if (participantCount > 0 && room.capacity > 0 && participantCount > room.capacity) {
      conflicts.push({
        type: 'capacity',
        message: `人数(${participantCount})超过排练室容量(${room.capacity})`,
      });
    }

    const qb = this.repo.createQueryBuilder('r').where(
      new Brackets((qb1) => {
        qb1.where('r.status IN (:...statuses)', {
          statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
        });
        qb1.andWhere('r.roomId = :roomId', { roomId });
        if (excludeReservationId) {
          qb1.andWhere('r.id != :excludeId', { excludeId: excludeReservationId });
        }
      }),
    );

    const existingReservations = await qb.getMany();
    for (const r of existingReservations) {
      const rStart = new Date(r.startTime);
      const rEnd = new Date(r.endTime);
      if (this.isTimeOverlap(start, end, rStart, rEnd)) {
        conflicts.push({
          type: 'room',
          message: `与预约「${r.purpose} - ${r.reserverName}」时间冲突 (${this.formatTime(rStart)} - ${this.formatTime(rEnd)})`,
          conflictingReservationId: r.id,
        });
      }
    }

    if (equipmentIds && equipmentIds.length > 0) {
      const equipmentList = await this.equipmentRepo.find({
        where: { id: In(equipmentIds) },
      });

      const invalidEquipment = equipmentIds.filter(
        (id) => !equipmentList.some((e) => e.id === id),
      );
      if (invalidEquipment.length > 0) {
        conflicts.push({
          type: 'equipment',
          message: `设备ID不存在: ${invalidEquipment.join(', ')}`,
        });
      }

      const unavailableEquipment = equipmentList.filter(
        (e) => e.status !== EquipmentStatus.NORMAL && e.status !== EquipmentStatus.IN_USE,
      );
      if (unavailableEquipment.length > 0) {
        conflicts.push({
          type: 'equipment',
          message: `设备不可用: ${unavailableEquipment.map((e) => `${e.name}(${e.status})`).join(', ')}`,
        });
      }

      for (const equipmentId of equipmentIds) {
        const equipmentReservations = await this.repo
          .createQueryBuilder('r')
          .where(
            new Brackets((qb1) => {
              qb1.where('r.status IN (:...statuses)', {
                statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
              });
              qb1.andWhere("r.equipmentIds LIKE '%' || :equipmentId || '%'", { equipmentId });
              if (excludeReservationId) {
                qb1.andWhere('r.id != :excludeId', { excludeId: excludeReservationId });
              }
            }),
          )
          .getMany();

        for (const r of equipmentReservations) {
          const rStart = new Date(r.startTime);
          const rEnd = new Date(r.endTime);
          if (this.isTimeOverlap(start, end, rStart, rEnd)) {
            const equipment = equipmentList.find((e) => e.id === equipmentId);
            conflicts.push({
              type: 'equipment',
              message: `设备「${equipment?.name || `#${equipmentId}`}」与预约「${r.reserverName}」时间冲突`,
              conflictingReservationId: r.id,
            });
          }
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  private isTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  private formatTime(date: Date): string {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async create(params: CreateReservationParams, operatorId: number, operatorName: string) {
    const { startTime, endTime, roomId, equipmentIds, participantCount } = params;

    const conflictResult = await this.checkConflicts(
      roomId,
      startTime,
      endTime,
      equipmentIds,
      participantCount,
    );

    if (conflictResult.hasConflict) {
      throw new BadRequestException({
        message: '预约存在冲突',
        conflicts: conflictResult.conflicts,
      });
    }

    const data: Partial<RoomReservation> = {
      ...params,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      participantIds: params.participantIds || [],
      equipmentIds: params.equipmentIds || [],
      createdBy: operatorId,
      userId: operatorId,
    };

    const item = this.repo.create(data);
    const saved = await this.repo.save(item);

    const room = await this.roomRepo.findOne({ where: { id: roomId } });

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ROOM_RESERVATION,
      module: AuditModule.ROOM_RESERVATION,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'room_reservation',
      detail: `创建预约: ${room?.name || `#${roomId}`} - ${this.formatTime(new Date(startTime))} ~ ${this.formatTime(new Date(endTime))}`,
      metadata: {
        roomId,
        startTime,
        endTime,
        purpose: params.purpose,
        reserverName: params.reserverName,
      },
    });

    return this.findOne(saved.id);
  }

  async findAll(
    roomId?: number,
    status?: ReservationStatus,
    dateFrom?: Date,
    dateTo?: Date,
    userId?: number,
  ) {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room', 'room')
      .leftJoinAndSelect('r.user', 'user')
      .orderBy('r.startTime', 'DESC');

    if (roomId) {
      qb.andWhere('r.roomId = :roomId', { roomId });
    }
    if (status) {
      qb.andWhere('r.status = :status', { status });
    }
    if (dateFrom) {
      qb.andWhere('r.startTime >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      qb.andWhere('r.startTime <= :dateTo', { dateTo: new Date(dateTo) });
    }
    if (userId) {
      qb.andWhere('r.userId = :userId', { userId });
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const reservation = await this.repo.findOne({
      where: { id },
      relations: ['room', 'user'],
    });
    if (!reservation) throw new NotFoundException('预约不存在');

    let equipmentList: Equipment[] = [];
    if (reservation.equipmentIds && reservation.equipmentIds.length > 0) {
      equipmentList = await this.equipmentRepo.find({
        where: { id: In(reservation.equipmentIds) },
      });
    }

    let participants: any[] = [];
    if (reservation.participantIds && reservation.participantIds.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(reservation.participantIds) },
      });
      participants = users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
      }));
    }

    return {
      ...reservation,
      equipmentList,
      participants,
    };
  }

  async update(
    id: number,
    data: Partial<RoomReservation>,
    operatorId: number,
    operatorName: string,
  ) {
    const oldReservation = await this.findOne(id);

    if (oldReservation.status === ReservationStatus.CANCELLED ||
        oldReservation.status === ReservationStatus.COMPLETED) {
      throw new BadRequestException('已取消或已完成的预约不能修改');
    }

    if (data.startTime || data.endTime || data.roomId || data.equipmentIds || data.participantCount !== undefined) {
      const roomId = data.roomId ?? oldReservation.roomId;
      const startTime = data.startTime ?? oldReservation.startTime;
      const endTime = data.endTime ?? oldReservation.endTime;
      const equipmentIds = data.equipmentIds ?? oldReservation.equipmentIds ?? [];
      const participantCount = data.participantCount ?? oldReservation.participantCount;

      const conflictResult = await this.checkConflicts(
        roomId,
        startTime,
        endTime,
        equipmentIds,
        participantCount,
        id,
      );

      if (conflictResult.hasConflict) {
        throw new BadRequestException({
          message: '修改后存在冲突',
          conflicts: conflictResult.conflicts,
        });
      }
    }

    await this.repo.update(id, {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    });

    const updated = await this.findOne(id);

    const changes: string[] = [];
    if (data.roomId !== undefined && data.roomId !== oldReservation.roomId) {
      const oldRoom = await this.roomRepo.findOne({ where: { id: oldReservation.roomId } });
      const newRoom = await this.roomRepo.findOne({ where: { id: data.roomId } });
      changes.push(`排练室: ${oldRoom?.name || '未知'} → ${newRoom?.name || '未知'}`);
    }
    if (data.startTime && new Date(data.startTime).getTime() !== new Date(oldReservation.startTime).getTime()) {
      changes.push(`开始时间: ${this.formatTime(new Date(oldReservation.startTime))} → ${this.formatTime(new Date(data.startTime))}`);
    }
    if (data.endTime && new Date(data.endTime).getTime() !== new Date(oldReservation.endTime).getTime()) {
      changes.push(`结束时间: ${this.formatTime(new Date(oldReservation.endTime))} → ${this.formatTime(new Date(data.endTime))}`);
    }
    if (data.status && data.status !== oldReservation.status) {
      changes.push(`状态: ${oldReservation.status} → ${data.status}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ROOM_RESERVATION,
      module: AuditModule.ROOM_RESERVATION,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'room_reservation',
      detail: changes.length > 0
        ? `更新预约: ${changes.join('; ')}`
        : `更新预约 #${id}`,
      metadata: { old: oldReservation, new: data },
    });

    return updated;
  }

  async approve(id: number, operatorId: number, operatorName: string) {
    const reservation = await this.findOne(id);
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('只有待审批的预约可以审核');
    }

    await this.repo.update(id, {
      status: ReservationStatus.CONFIRMED,
      approvedBy: operatorId,
    });

    const updated = await this.findOne(id);

    await this.auditLogsService.log({
      action: AuditAction.APPROVE_ROOM_RESERVATION,
      module: AuditModule.ROOM_RESERVATION,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'room_reservation',
      detail: `审批通过预约 #${id} - ${reservation.reserverName}`,
      metadata: { reservationId: id },
    });

    return updated;
  }

  async reject(id: number, rejectReason: string, operatorId: number, operatorName: string) {
    const reservation = await this.findOne(id);
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('只有待审批的预约可以审核');
    }

    await this.repo.update(id, {
      status: ReservationStatus.CANCELLED,
      rejectReason,
      approvedBy: operatorId,
    });

    const updated = await this.findOne(id);

    await this.auditLogsService.log({
      action: AuditAction.REJECT_ROOM_RESERVATION,
      module: AuditModule.ROOM_RESERVATION,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'room_reservation',
      detail: `拒绝预约 #${id} - ${reservation.reserverName}, 原因: ${rejectReason}`,
      metadata: { reservationId: id, rejectReason },
    });

    return updated;
  }

  async cancel(id: number, operatorId: number, operatorName: string) {
    const reservation = await this.findOne(id);
    if (reservation.status === ReservationStatus.CANCELLED ||
        reservation.status === ReservationStatus.COMPLETED) {
      throw new BadRequestException('该预约状态无法取消');
    }

    await this.repo.update(id, {
      status: ReservationStatus.CANCELLED,
    });

    const updated = await this.findOne(id);

    await this.auditLogsService.log({
      action: AuditAction.CANCEL_ROOM_RESERVATION,
      module: AuditModule.ROOM_RESERVATION,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'room_reservation',
      detail: `取消预约 #${id} - ${reservation.reserverName}`,
      metadata: { reservationId: id },
    });

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const reservation = await this.findOne(id);
    await this.repo.delete(id);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_ROOM_RESERVATION,
      module: AuditModule.ROOM_RESERVATION,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'room_reservation',
      detail: `删除预约 #${id} - ${reservation.reserverName}`,
      metadata: { reservationId: id },
    });

    return { success: true };
  }

  async getUsageStatistics(startDate: Date, endDate: Date) {
    const queryStart = new Date(startDate);
    const queryEnd = new Date(endDate);

    const reservations = await this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room', 'room')
      .where('r.status = :status', { status: ReservationStatus.COMPLETED })
      .andWhere('r.startTime < :queryEnd', { queryEnd })
      .andWhere('r.endTime > :queryStart', { queryStart })
      .getMany();

    const totalReservations = reservations.length;
    let totalHours = 0;
    const roomStats: Record<number, { name: string; count: number; hours: number }> = {};
    const purposeStats: Record<string, number> = {};
    let totalParticipants = 0;

    for (const r of reservations) {
      const rStart = new Date(r.startTime);
      const rEnd = new Date(r.endTime);
      const effectiveStart = rStart < queryStart ? queryStart : rStart;
      const effectiveEnd = rEnd > queryEnd ? queryEnd : rEnd;
      const hours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
      totalHours += hours;
      totalParticipants += r.participantCount;

      if (!roomStats[r.roomId]) {
        roomStats[r.roomId] = { name: r.room?.name || `#${r.roomId}`, count: 0, hours: 0 };
      }
      roomStats[r.roomId].count++;
      roomStats[r.roomId].hours += hours;

      purposeStats[r.purpose] = (purposeStats[r.purpose] || 0) + 1;
    }

    const allRooms = await this.roomRepo.find({ where: { status: RoomStatus.AVAILABLE } });
    const utilizationRates: Record<number, { name: string; rate: number }> = {};

    const periodHours = (queryEnd.getTime() - queryStart.getTime()) / (1000 * 60 * 60);
    for (const room of allRooms) {
      const stat = roomStats[room.id] || { count: 0, hours: 0, name: room.name };
      utilizationRates[room.id] = {
        name: room.name,
        rate: periodHours > 0 ? parseFloat(((stat.hours / periodHours) * 100).toFixed(2)) : 0,
      };
    }

    return {
      period: { startDate, endDate },
      totalReservations,
      totalHours: parseFloat(totalHours.toFixed(2)),
      avgParticipants: totalReservations > 0
        ? parseFloat((totalParticipants / totalReservations).toFixed(1))
        : 0,
      avgHoursPerReservation: totalReservations > 0
        ? parseFloat((totalHours / totalReservations).toFixed(2))
        : 0,
      roomStats,
      purposeStats,
      utilizationRates,
    };
  }

  async getMyReservations(userId: number, status?: ReservationStatus) {
    const where: any = { userId };
    if (status) where.status = status;

    return this.repo.find({
      where,
      order: { startTime: 'DESC' },
      relations: ['room'],
    });
  }

  async getUpcomingReservations(roomId?: number, limit: number = 10) {
    const where: any = {
      status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
      startTime: MoreThan(new Date()),
    };
    if (roomId) where.roomId = roomId;

    return this.repo.find({
      where,
      order: { startTime: 'ASC' },
      take: limit,
      relations: ['room', 'user'],
    });
  }

  async getDailyReservations(date: Date, roomId?: number) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room', 'room')
      .where('r.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      })
      .andWhere('r.startTime < :endOfDay', { endOfDay })
      .andWhere('r.endTime > :startOfDay', { startOfDay })
      .orderBy('r.startTime', 'ASC');

    if (roomId) {
      qb.andWhere('r.roomId = :roomId', { roomId });
    }

    return qb.getMany();
  }
}
