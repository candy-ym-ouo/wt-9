import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, In } from 'typeorm';
import { Rehearsal, User, CastRole, LeaveRequest, LeaveStatus, Material, AuditAction, AuditModule } from '../entities';
import { LeavesService } from '../leaves/leaves.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface ConflictInfo {
  hasConflict: boolean;
  timeConflicts: Rehearsal[];
  participantConflicts: Array<{
    userId: number;
    userName?: string;
    conflictingRehearsals: Rehearsal[];
  }>;
  locationConflicts: Rehearsal[];
}

export interface ParticipantInfo {
  userId: number;
  userName?: string;
  displayName?: string;
  isOnLeave: boolean;
  leaveReason?: string;
  substituteId?: number;
  substituteName?: string;
  roleId?: number;
  roleName?: string;
  attendanceStatus?: 'present' | 'absent' | 'late' | null;
  absentReason?: string;
  checkInTime?: string;
}

export interface AttendanceUpdate {
  userId: number;
  status: 'present' | 'absent' | 'late' | null;
  absentReason?: string;
}

export interface RehearsalStatistics {
  totalRehearsals: number;
  totalParticipants: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  pendingCount: number;
  attendanceRate: number;
  byUser: Array<{
    userId: number;
    userName: string;
    displayName?: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  }>;
}

@Injectable()
export class RehearsalsService {
  constructor(
    @InjectRepository(Rehearsal)
    private repo: Repository<Rehearsal>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    private leavesService: LeavesService,
    private auditLogsService: AuditLogsService,
  ) {}

  async checkConflicts(
    startTime: Date,
    endTime: Date,
    participantIds: number[] = [],
    excludeId?: number,
    location?: string,
  ): Promise<ConflictInfo> {
    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const allRehearsals = await this.repo.find();
    const otherRehearsals = excludeId
      ? allRehearsals.filter((r) => r.id !== excludeId)
      : allRehearsals;

    const timeConflicts: Rehearsal[] = [];
    for (const r of otherRehearsals) {
      if (this.isTimeOverlap(startTime, endTime, r.startTime, r.endTime)) {
        timeConflicts.push(r);
      }
    }

    const participantConflicts: ConflictInfo['participantConflicts'] = [];
    for (const userId of participantIds) {
      const conflicting: Rehearsal[] = [];
      for (const r of otherRehearsals) {
        const rParticipants = r.participantIds || [];
        if (
          rParticipants.includes(userId) &&
          this.isTimeOverlap(startTime, endTime, r.startTime, r.endTime)
        ) {
          conflicting.push(r);
        }
      }
      if (conflicting.length > 0) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        participantConflicts.push({
          userId,
          userName: user?.displayName || user?.username,
          conflictingRehearsals: conflicting,
        });
      }
    }

    const locationConflicts: Rehearsal[] = [];
    if (location && location.trim()) {
      const trimmedLocation = location.trim().toLowerCase();
      for (const r of otherRehearsals) {
        if (
          r.location &&
          r.location.trim().toLowerCase() === trimmedLocation &&
          this.isTimeOverlap(startTime, endTime, r.startTime, r.endTime)
        ) {
          locationConflicts.push(r);
        }
      }
    }

    return {
      hasConflict:
        timeConflicts.length > 0 ||
        participantConflicts.length > 0 ||
        locationConflicts.length > 0,
      timeConflicts,
      participantConflicts,
      locationConflicts,
    };
  }

  private isTimeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  async create(data: Partial<Rehearsal>, operatorId?: number, operatorName?: string) {
    const startTime = data.startTime instanceof Date ? data.startTime : new Date(data.startTime!);
    const endTime = data.endTime instanceof Date ? data.endTime : new Date(data.endTime!);

    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const materialIds = data.materialIds || [];
    if (materialIds.length > 0) {
      const uniqueIds = Array.from(new Set(materialIds));
      const materials = await this.materialRepo.findBy({ id: In(uniqueIds) });
      if (materials.length !== uniqueIds.length) {
        const foundIds = materials.map((m) => m.id);
        const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(`素材ID不存在: ${missingIds.join(', ')}`);
      }
    }

    if (data.location && data.location.trim()) {
      const conflict = await this.checkConflicts(
        startTime,
        endTime,
        [],
        undefined,
        data.location,
      );
      if (conflict.locationConflicts.length > 0) {
        const titles = conflict.locationConflicts.map((r) => r.title).join('、');
        throw new BadRequestException(`地点「${data.location}」在此时间段已被占用：${titles}`);
      }
    }

    const item = this.repo.create({ ...data, materialIds });
    const saved = await this.repo.save(item);

    if (operatorId !== undefined) {
      const timeStr = `${startTime.toLocaleString('zh-CN')} ~ ${endTime.toLocaleString('zh-CN')}`;
      await this.auditLogsService.log({
        action: AuditAction.CREATE_REHEARSAL,
        module: AuditModule.REHEARSAL,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'rehearsal',
        detail: `创建排练「${saved.title}」(${data.location || '无地点'}, ${timeStr})`,
        metadata: {
          title: saved.title,
          location: saved.location,
          startTime: saved.startTime,
          endTime: saved.endTime,
          participantIds: saved.participantIds,
          materialIds: saved.materialIds,
        },
      });
    }

    return saved;
  }

  async findAll() {
    return this.repo.find({ order: { startTime: 'ASC' } });
  }

  async findByDateRange(start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const all = await this.repo.find({ order: { startTime: 'ASC' } });
    return all.filter(
      (r) => this.isTimeOverlap(startDate, endDate, r.startTime, r.endTime),
    );
  }

  async findWithFilters(filters: {
    start?: string;
    end?: string;
    location?: string;
    participantId?: string;
    timeSlot?: string;
    attendanceStatus?: string;
  }) {
    let result = await this.repo.find({ order: { startTime: 'ASC' } });

    if (filters.start && filters.end) {
      const startDate = new Date(filters.start);
      const endDate = new Date(filters.end);
      result = result.filter((r) =>
        this.isTimeOverlap(startDate, endDate, r.startTime, r.endTime),
      );
    }

    if (filters.location) {
      result = result.filter((r) =>
        r.location?.toLowerCase().includes(filters.location!.toLowerCase()),
      );
    }

    if (filters.participantId) {
      const pid = parseInt(filters.participantId, 10);
      if (!isNaN(pid)) {
        result = result.filter((r) => r.participantIds?.includes(pid));
      }
    }

    if (filters.timeSlot) {
      const [startHour, startMin, endHour, endMin] = filters.timeSlot
        .split('-')
        .flatMap((s) => s.split(':').map(Number));
      if (![startHour, startMin, endHour, endMin].some(isNaN)) {
        result = result.filter((r) => {
          const rStart = r.startTime.getHours() * 60 + r.startTime.getMinutes();
          const rEnd = r.endTime.getHours() * 60 + r.endTime.getMinutes();
          const fStart = startHour * 60 + startMin;
          const fEnd = endHour * 60 + endMin;
          return rStart < fEnd && rEnd > fStart;
        });
      }
    }

    if (filters.attendanceStatus) {
      const status = filters.attendanceStatus;
      const pid = filters.participantId ? parseInt(filters.participantId, 10) : null;

      result = result.filter((r) => {
        const attendance = r.attendance || {};
        const participantIds = r.participantIds || [];

        if (pid !== null && !isNaN(pid)) {
          if (!participantIds.includes(pid)) return false;
          const userAttendance = attendance[String(pid)] || attendance[pid];
          const userStatus = userAttendance?.status || null;

          if (status === 'pending') {
            return userStatus === null || userStatus === undefined;
          }
          return userStatus === status;
        } else {
          const hasMatch = participantIds.some((userId) => {
            const userAttendance = attendance[String(userId)] || attendance[userId];
            const userStatus = userAttendance?.status || null;

            if (status === 'pending') {
              return userStatus === null || userStatus === undefined;
            }
            return userStatus === status;
          });
          return hasMatch;
        }
      });
    }

    return result;
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Rehearsal>, operatorId?: number, operatorName?: string) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new BadRequestException('排练不存在');
    }

    const startTime = data.startTime
      ? data.startTime instanceof Date
        ? data.startTime
        : new Date(data.startTime)
      : existing.startTime;
    const endTime = data.endTime
      ? data.endTime instanceof Date
        ? data.endTime
        : new Date(data.endTime)
      : existing.endTime;

    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const participantIds = data.participantIds ?? existing.participantIds ?? [];

    let materialIds = existing.materialIds ?? [];
    if (data.materialIds !== undefined) {
      const uniqueIds = Array.from(new Set(data.materialIds));
      if (uniqueIds.length > 0) {
        const materials = await this.materialRepo.findBy({ id: In(uniqueIds) });
        if (materials.length !== uniqueIds.length) {
          const foundIds = materials.map((m) => m.id);
          const missingIds = uniqueIds.filter((mid) => !foundIds.includes(mid));
          throw new BadRequestException(`素材ID不存在: ${missingIds.join(', ')}`);
        }
      }
      materialIds = uniqueIds;
    }

    const location = data.location !== undefined ? data.location : existing.location;
    if (location && location.trim()) {
      const conflict = await this.checkConflicts(
        startTime,
        endTime,
        [],
        id,
        location,
      );
      if (conflict.locationConflicts.length > 0) {
        const titles = conflict.locationConflicts.map((r) => r.title).join('、');
        throw new BadRequestException(`地点「${location}」在此时间段已被占用：${titles}`);
      }
    }

    await this.repo.update(id, {
      ...data,
      startTime,
      endTime,
      participantIds,
      materialIds,
    });

    if (operatorId !== undefined) {
      const changes: string[] = [];
      if (data.title && data.title !== existing.title) {
        changes.push(`标题: ${existing.title} → ${data.title}`);
      }
      if (data.location !== undefined && data.location !== existing.location) {
        changes.push(`地点: ${existing.location || '无'} → ${data.location || '无'}`);
      }
      if (data.startTime || data.endTime) {
        changes.push(`时间变更`);
      }
      if (data.participantIds) {
        changes.push(`参与人员变更`);
      }
      if (data.materialIds) {
        changes.push(`关联素材变更`);
      }

      await this.auditLogsService.log({
        action: AuditAction.UPDATE_REHEARSAL,
        module: AuditModule.REHEARSAL,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'rehearsal',
        detail: changes.length > 0
          ? `更新排练「${existing.title}」: ${changes.join('; ')}`
          : `更新排练「${existing.title}」`,
        metadata: { old: existing, new: data },
      });
    }

    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number, operatorId?: number, operatorName?: string) {
    const rehearsal = await this.repo.findOne({ where: { id } });
    if (rehearsal && operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_REHEARSAL,
        module: AuditModule.REHEARSAL,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'rehearsal',
        detail: `删除排练「${rehearsal.title}」`,
        metadata: {
          title: rehearsal.title,
          location: rehearsal.location,
          startTime: rehearsal.startTime,
          endTime: rehearsal.endTime,
        },
      });
    }
    return this.repo.delete(id);
  }

  async enrichWithConflictInfo(rehearsals: Rehearsal[]): Promise<any[]> {
    const result: any[] = [];
    for (const r of rehearsals) {
      const conflict = await this.checkConflicts(
        r.startTime,
        r.endTime,
        r.participantIds || [],
        r.id,
        r.location,
      );
      result.push({
        ...r,
        hasConflict: conflict.hasConflict,
        timeConflicts: conflict.timeConflicts,
        participantConflicts: conflict.participantConflicts,
        locationConflicts: conflict.locationConflicts,
      });
    }
    return result;
  }

  async getParticipantsWithLeaveInfo(rehearsal: Rehearsal): Promise<ParticipantInfo[]> {
    const participantIds = rehearsal.participantIds || [];
    if (participantIds.length === 0) {
      return [];
    }

    const users = await this.userRepo.findByIds(participantIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const activeLeaves = await this.leavesService.getActiveLeavesForDateRange(
      rehearsal.startTime,
      rehearsal.endTime,
    );

    const roles = await this.roleRepo.find();
    const roleByActor = new Map<number, CastRole>();
    roles.forEach((role) => {
      if (role.actorId) {
        roleByActor.set(role.actorId, role);
      }
    });

    const attendance = rehearsal.attendance || {};

    const result: ParticipantInfo[] = [];
    for (const userId of participantIds) {
      const user = userMap.get(userId);
      const leave = activeLeaves.find((l) => l.actorId === userId);
      const role = roleByActor.get(userId);
      const userAttendance = attendance[String(userId)] || attendance[userId];

      let substituteId: number | undefined;
      let substituteName: string | undefined;

      if (leave && leave.substituteActorId) {
        substituteId = leave.substituteActorId;
        const subUser = userMap.get(leave.substituteActorId);
        substituteName = subUser?.displayName || subUser?.username;
      } else if (role?.substituteActorIds && role.substituteActorIds.length > 0) {
        const availableSub = role.substituteActorIds.find((subId) => {
          const subLeave = activeLeaves.find((l) => l.actorId === subId);
          return !subLeave;
        });
        if (availableSub) {
          substituteId = availableSub;
          const subUser = userMap.get(availableSub);
          substituteName = subUser?.displayName || subUser?.username;
        }
      }

      result.push({
        userId,
        userName: user?.username,
        displayName: user?.displayName,
        isOnLeave: !!leave,
        leaveReason: leave?.reason,
        substituteId,
        substituteName,
        roleId: role?.id,
        roleName: role?.characterName,
        attendanceStatus: userAttendance?.status ?? null,
        absentReason: userAttendance?.absentReason,
        checkInTime: userAttendance?.checkInTime,
      });
    }

    return result;
  }

  async enrichWithParticipantInfo(rehearsals: Rehearsal[]): Promise<any[]> {
    const result: any[] = [];
    for (const r of rehearsals) {
      const participants = await this.getParticipantsWithLeaveInfo(r);
      const onLeaveCount = participants.filter((p) => p.isOnLeave).length;
      const withSubstituteCount = participants.filter((p) => p.substituteId).length;
      const presentCount = participants.filter((p) => p.attendanceStatus === 'present').length;
      const absentCount = participants.filter((p) => p.attendanceStatus === 'absent').length;
      const lateCount = participants.filter((p) => p.attendanceStatus === 'late').length;
      const pendingAttendanceCount = participants.filter((p) => !p.attendanceStatus).length;

      result.push({
        ...r,
        participants,
        onLeaveCount,
        withSubstituteCount,
        presentCount,
        absentCount,
        lateCount,
        pendingAttendanceCount,
        effectiveParticipants: participants
          .map((p) => (p.isOnLeave && p.substituteId ? p.substituteId : p.userId))
          .filter((id, index, arr) => arr.indexOf(id) === index),
      });
    }
    return result;
  }

  async findOneWithDetails(id: number) {
    const rehearsal = await this.repo.findOne({ where: { id } });
    if (!rehearsal) {
      return null;
    }
    const enriched = await this.enrichWithParticipantInfo([rehearsal]);
    const withConflict = await this.enrichWithConflictInfo([rehearsal]);
    return { ...enriched[0], ...withConflict[0] };
  }

  async updateAttendance(id: number, updates: AttendanceUpdate[], operatorId?: number, operatorName?: string) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new BadRequestException('排练不存在');
    }

    const currentAttendance = existing.attendance || {};
    const newAttendance: Record<string, any> = { ...currentAttendance };

    const statusLabels: Record<string, string> = {
      present: '出勤',
      absent: '缺席',
      late: '迟到',
      null: '未签到',
    };

    const changeDetails: string[] = [];

    for (const update of updates) {
      if (!existing.participantIds?.includes(update.userId)) {
        continue;
      }
      const key = String(update.userId);
      const existingRecord = currentAttendance[key] || currentAttendance[update.userId];
      const oldStatus = existingRecord?.status || null;
      const newStatus = update.status;

      if (oldStatus !== newStatus) {
        const user = await this.userRepo.findOne({ where: { id: update.userId } });
        const userName = user?.displayName || user?.username || `#${update.userId}`;
        changeDetails.push(`${userName}: ${statusLabels[String(oldStatus)] || '未签到'} → ${statusLabels[String(newStatus)] || '未签到'}`);
      }

      newAttendance[key] = {
        status: update.status,
        absentReason: update.absentReason,
        checkInTime: update.status === 'present' || update.status === 'late'
          ? new Date().toISOString()
          : existingRecord?.checkInTime,
      };
    }

    await this.repo.update(id, { attendance: newAttendance });

    if (operatorId !== undefined && changeDetails.length > 0) {
      await this.auditLogsService.log({
        action: AuditAction.UPDATE_ATTENDANCE,
        module: AuditModule.REHEARSAL,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'rehearsal',
        detail: `更新排练「${existing.title}」考勤: ${changeDetails.join('; ')}`,
        metadata: { updates },
      });
    }

    return this.findOneWithDetails(id);
  }

  getLastWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setMilliseconds(-1);

    return { start: lastMonday, end: lastSunday };
  }

  async getLastWeekRehearsals(): Promise<Rehearsal[]> {
    const { start, end } = this.getLastWeekRange();
    const all = await this.repo.find({ order: { startTime: 'ASC' } });
    return all.filter((r) =>
      this.isTimeOverlap(start, end, r.startTime, r.endTime),
    );
  }

  async copyRehearsalToNextWeek(
    sourceId: number,
    operatorId?: number,
    operatorName?: string,
  ): Promise<Rehearsal> {
    const source = await this.repo.findOne({ where: { id: sourceId } });
    if (!source) {
      throw new BadRequestException('源排练不存在');
    }

    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const newStartTime = new Date(source.startTime.getTime() + ONE_WEEK_MS);
    const newEndTime = new Date(source.endTime.getTime() + ONE_WEEK_MS);

    if (source.location && source.location.trim()) {
      const conflict = await this.checkConflicts(
        newStartTime,
        newEndTime,
        [],
        undefined,
        source.location,
      );
      if (conflict.locationConflicts.length > 0) {
        const titles = conflict.locationConflicts.map((r) => r.title).join('、');
        throw new BadRequestException(`地点「${source.location}」在下周同一时间段已被占用：${titles}`);
      }
    }

    const newRehearsal = this.repo.create({
      title: source.title,
      description: source.description,
      startTime: newStartTime,
      endTime: newEndTime,
      location: source.location,
      participantIds: source.participantIds || [],
      materialIds: source.materialIds || [],
      createdBy: operatorId,
    });

    const saved = await this.repo.save(newRehearsal);

    if (operatorId !== undefined) {
      const timeStr = `${newStartTime.toLocaleString('zh-CN')} ~ ${newEndTime.toLocaleString('zh-CN')}`;
      await this.auditLogsService.log({
        action: AuditAction.CREATE_REHEARSAL,
        module: AuditModule.REHEARSAL,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'rehearsal',
        detail: `复制排练「${source.title}」(${source.location || '无地点'}, ${timeStr})`,
        metadata: {
          sourceId,
          title: saved.title,
          location: saved.location,
          startTime: saved.startTime,
          endTime: saved.endTime,
          participantIds: saved.participantIds,
          materialIds: saved.materialIds,
        },
      });
    }

    return saved;
  }

  async copyLastWeekAll(
    operatorId?: number,
    operatorName?: string,
  ): Promise<{ created: Rehearsal[]; skipped: Array<{ rehearsal: Rehearsal; reason: string }> }> {
    const lastWeekRehearsals = await this.getLastWeekRehearsals();
    const created: Rehearsal[] = [];
    const skipped: Array<{ rehearsal: Rehearsal; reason: string }> = [];

    for (const r of lastWeekRehearsals) {
      try {
        const newR = await this.copyRehearsalToNextWeek(r.id, operatorId, operatorName);
        created.push(newR);
      } catch (e: any) {
        skipped.push({ rehearsal: r, reason: e.message });
      }
    }

    return { created, skipped };
  }

  async getStatistics(start?: string, end?: string): Promise<RehearsalStatistics> {
    let rehearsals = await this.repo.find({ order: { startTime: 'ASC' } });

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      rehearsals = rehearsals.filter((r) =>
        this.isTimeOverlap(startDate, endDate, r.startTime, r.endTime),
      );
    }

    let totalParticipants = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let pendingCount = 0;

    const userStats = new Map<number, {
      userId: number;
      userName: string;
      displayName?: string;
      total: number;
      present: number;
      absent: number;
      late: number;
    }>();

    const allUsers = await this.userRepo.find();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    for (const rehearsal of rehearsals) {
      const participantIds = rehearsal.participantIds || [];
      const attendance = rehearsal.attendance || {};

      for (const userId of participantIds) {
        totalParticipants++;
        const userAttendance = attendance[String(userId)] || attendance[userId];
        const status = userAttendance?.status;

        if (status === 'present') {
          presentCount++;
        } else if (status === 'absent') {
          absentCount++;
        } else if (status === 'late') {
          lateCount++;
        } else {
          pendingCount++;
        }

        if (!userStats.has(userId)) {
          const user = userMap.get(userId);
          userStats.set(userId, {
            userId,
            userName: user?.username || `user_${userId}`,
            displayName: user?.displayName,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          });
        }

        const stat = userStats.get(userId)!;
        stat.total++;
        if (status === 'present') stat.present++;
        else if (status === 'absent') stat.absent++;
        else if (status === 'late') stat.late++;
      }
    }

    const byUser = Array.from(userStats.values()).map((s) => ({
      ...s,
      attendanceRate: s.total > 0 ? ((s.present + s.late * 0.5) / s.total) * 100 : 0,
    }));

    const attendanceRate = totalParticipants > 0
      ? ((presentCount + lateCount * 0.5) / totalParticipants) * 100
      : 0;

    return {
      totalRehearsals: rehearsals.length,
      totalParticipants,
      presentCount,
      absentCount,
      lateCount,
      pendingCount,
      attendanceRate,
      byUser,
    };
  }
}
