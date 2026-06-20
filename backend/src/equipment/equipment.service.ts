import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Equipment, EquipmentStatus, AuditAction, AuditModule } from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RoomReservation, ReservationStatus } from '../entities/room-reservation.entity';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private repo: Repository<Equipment>,
    @InjectRepository(RoomReservation)
    private reservationRepo: Repository<RoomReservation>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(data: Partial<Equipment>, operatorId: number, operatorName: string) {
    const item = this.repo.create(data);
    const saved = await this.repo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_EQUIPMENT,
      module: AuditModule.EQUIPMENT,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'equipment',
      detail: `创建设备「${saved.name}」`,
      metadata: { name: saved.name, category: saved.category, code: saved.code },
    });

    return this.findOne(saved.id);
  }

  async findAll(status?: EquipmentStatus, category?: string, roomId?: number) {
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (roomId !== undefined) where.roomId = roomId;

    return this.repo.find({
      where,
      order: { id: 'ASC' },
      relations: ['room'],
    });
  }

  async findOne(id: number) {
    const equipment = await this.repo.findOne({
      where: { id },
      relations: ['room'],
    });
    if (!equipment) throw new NotFoundException('设备不存在');
    return equipment;
  }

  async findByIds(ids: number[]) {
    if (!ids || ids.length === 0) return [];
    return this.repo.find({
      where: { id: In(ids) },
    });
  }

  async getAvailableEquipment(startTime: Date, endTime: Date, category?: string) {
    const where: any = { status: EquipmentStatus.NORMAL };
    if (category) where.category = category;

    const allEquipment = await this.repo.find({ where });

    const reservations = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.CONFIRMED,
      },
    });

    const inUseEquipmentIds = new Set<number>();
    for (const r of reservations) {
      const overlap = this.isTimeOverlap(
        new Date(r.startTime),
        new Date(r.endTime),
        new Date(startTime),
        new Date(endTime),
      );
      if (overlap && r.equipmentIds) {
        r.equipmentIds.forEach((id) => inUseEquipmentIds.add(id));
      }
    }

    return allEquipment.filter((e) => !inUseEquipmentIds.has(e.id));
  }

  private isTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  async update(id: number, data: Partial<Equipment>, operatorId: number, operatorName: string) {
    const oldEquipment = await this.findOne(id);
    await this.repo.update(id, data);
    const updated = await this.findOne(id);

    const changes: string[] = [];
    if (data.name && data.name !== oldEquipment.name) {
      changes.push(`名称: ${oldEquipment.name} → ${data.name}`);
    }
    if (data.status && data.status !== oldEquipment.status) {
      changes.push(`状态: ${oldEquipment.status} → ${data.status}`);
    }
    if (data.roomId !== undefined && data.roomId !== oldEquipment.roomId) {
      changes.push(`所属房间: ${oldEquipment.roomId || '无'} → ${data.roomId || '无'}`);
    }
    if (data.category && data.category !== oldEquipment.category) {
      changes.push(`类别: ${oldEquipment.category} → ${data.category}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_EQUIPMENT,
      module: AuditModule.EQUIPMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'equipment',
      detail: changes.length > 0
        ? `更新设备「${oldEquipment.name}」: ${changes.join('; ')}`
        : `更新设备「${oldEquipment.name}」`,
      metadata: { old: oldEquipment, new: data },
    });

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const equipment = await this.findOne(id);

    const activeReservations = await this.reservationRepo.find({
      where: {
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
      },
    });

    const inUse = activeReservations.some((r) => r.equipmentIds?.includes(id));
    if (inUse) {
      throw new BadRequestException('该设备正在被预约使用中，无法删除');
    }

    await this.repo.delete(id);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_EQUIPMENT,
      module: AuditModule.EQUIPMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'equipment',
      detail: `删除设备「${equipment.name}」`,
      metadata: { name: equipment.name, code: equipment.code },
    });

    return { success: true };
  }

  async getEquipmentStats(startDate: Date, endDate: Date) {
    const allEquipment = await this.repo.find();

    const queryStart = new Date(startDate);
    const queryEnd = new Date(endDate);

    const reservations = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: ReservationStatus.COMPLETED })
      .andWhere('r.startTime < :queryEnd', { queryEnd })
      .andWhere('r.endTime > :queryStart', { queryStart })
      .getMany();

    const usageCount: Record<number, number> = {};
    const usageHours: Record<number, number> = {};
    for (const r of reservations) {
      if (r.equipmentIds) {
        const rStart = new Date(r.startTime);
        const rEnd = new Date(r.endTime);
        const effectiveStart = rStart < queryStart ? queryStart : rStart;
        const effectiveEnd = rEnd > queryEnd ? queryEnd : rEnd;
        const hours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);

        r.equipmentIds.forEach((id) => {
          usageCount[id] = (usageCount[id] || 0) + 1;
          usageHours[id] = (usageHours[id] || 0) + hours;
        });
      }
    }

    const categoryStats: Record<string, { total: number; inUse: number; usageCount: number; usageHours: number }> = {};
    for (const e of allEquipment) {
      if (!categoryStats[e.category]) {
        categoryStats[e.category] = { total: 0, inUse: 0, usageCount: 0, usageHours: 0 };
      }
      categoryStats[e.category].total++;
      if (e.status === EquipmentStatus.IN_USE) {
        categoryStats[e.category].inUse++;
      }
      categoryStats[e.category].usageCount += usageCount[e.id] || 0;
      categoryStats[e.category].usageHours += usageHours[e.id] || 0;
    }

    const statusStats = {
      normal: allEquipment.filter((e) => e.status === EquipmentStatus.NORMAL).length,
      inUse: allEquipment.filter((e) => e.status === EquipmentStatus.IN_USE).length,
      maintenance: allEquipment.filter((e) => e.status === EquipmentStatus.MAINTENANCE).length,
      damaged: allEquipment.filter((e) => e.status === EquipmentStatus.DAMAGED).length,
      lost: allEquipment.filter((e) => e.status === EquipmentStatus.LOST).length,
    };

    const equipmentUsage = allEquipment.map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code,
      category: e.category,
      status: e.status,
      usageCount: usageCount[e.id] || 0,
      usageHours: parseFloat((usageHours[e.id] || 0).toFixed(2)),
    }));

    return {
      total: allEquipment.length,
      statusStats,
      categoryStats,
      usageCount,
      usageHours: Object.fromEntries(
        Object.entries(usageHours).map(([k, v]) => [k, parseFloat(v.toFixed(2))]),
      ),
      equipmentUsage,
    };
  }
}
