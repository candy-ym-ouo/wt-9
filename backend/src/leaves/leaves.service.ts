import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LeaveRequest, LeaveStatus, LeaveType, CastRole, User, Rehearsal, AuditAction, AuditModule } from '../entities';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(LeaveRequest)
    private repo: Repository<LeaveRequest>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    private notificationsService: NotificationsService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(data: Partial<LeaveRequest>, userId: number) {
    const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate!);
    const endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate!);

    if (startDate >= endDate) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const item = this.repo.create({
      ...data,
      startDate,
      endDate,
      status: LeaveStatus.PENDING,
      createdBy: userId,
      actorId: userId,
    });
    const saved = await this.repo.save(item);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const userName = user?.displayName || user?.username || `用户#${userId}`;

    const leaveTypeLabels: Record<LeaveType, string> = {
      [LeaveType.SICK]: '病假',
      [LeaveType.PERSONAL]: '事假',
      [LeaveType.OTHER]: '其他',
    };

    await this.auditLogsService.log({
      action: AuditAction.CREATE_LEAVE,
      module: AuditModule.LEAVE,
      operatorId: userId,
      operatorName: userName,
      targetUserId: userId,
      targetUsername: userName,
      targetId: saved.id,
      targetType: 'leave',
      detail: `提交${leaveTypeLabels[saved.type]}申请，时间：${startDate.toLocaleDateString('zh-CN')} 至 ${endDate.toLocaleDateString('zh-CN')}${saved.reason ? `，原因：${saved.reason}` : ''}`,
      metadata: { leave: saved },
    });

    this.notificationsService.notifyLeaveSubmitted(
      saved.id,
      userName,
      saved.type,
      startDate,
      endDate,
      saved.reason,
      userId,
    ).catch(() => {});

    return saved;
  }

  async findAll(filters?: {
    actorId?: number;
    status?: LeaveStatus;
    roleId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (filters?.actorId) where.actorId = filters.actorId;
    if (filters?.status) where.status = filters.status;
    if (filters?.roleId) where.roleId = filters.roleId;

    let leaves = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      leaves = leaves.filter((l) => this.isDateOverlap(l.startDate, l.endDate, start, end));
    }

    return this.enrichWithUserInfo(leaves);
  }

  async findOne(id: number) {
    const leave = await this.repo.findOne({ where: { id } });
    if (!leave) {
      throw new NotFoundException('请假记录不存在');
    }
    const enriched = await this.enrichWithUserInfo([leave]);
    return enriched[0];
  }

  async update(id: number, data: Partial<LeaveRequest>, operatorId?: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('请假记录不存在');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('只有待审批的请假可以修改');
    }

    await this.repo.update(id, data);
    const updated = await this.repo.findOne({ where: { id } });

    if (operatorId !== undefined && updated) {
      const operator = await this.userRepo.findOne({ where: { id: operatorId } });
      const operatorName = operator?.displayName || operator?.username || `用户#${operatorId}`;

      const changes: string[] = [];
      if (data.type && data.type !== existing.type) {
        changes.push(`类型变更`);
      }
      if (data.startDate || data.endDate) {
        changes.push(`时间变更`);
      }
      if (data.reason !== undefined && data.reason !== existing.reason) {
        changes.push(`原因变更`);
      }
      if (data.roleId !== undefined && data.roleId !== existing.roleId) {
        changes.push(`角色变更`);
      }
      if (data.substituteActorId !== undefined && data.substituteActorId !== existing.substituteActorId) {
        changes.push(`替补演员变更`);
      }

      if (changes.length > 0) {
        await this.auditLogsService.log({
          action: AuditAction.UPDATE_LEAVE,
          module: AuditModule.LEAVE,
          operatorId,
          operatorName,
          targetId: id,
          targetType: 'leave',
          detail: `更新请假申请: ${changes.join('; ')}`,
          metadata: { old: existing, new: data },
        });
      }
    }

    return updated;
  }

  async remove(id: number, operatorId?: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('请假记录不存在');
    }

    if (operatorId !== undefined) {
      const operator = await this.userRepo.findOne({ where: { id: operatorId } });
      const operatorName = operator?.displayName || operator?.username || `用户#${operatorId}`;

      await this.auditLogsService.log({
        action: AuditAction.DELETE_LEAVE,
        module: AuditModule.LEAVE,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'leave',
        detail: `删除请假申请`,
        metadata: { leave: existing },
      });
    }

    return this.repo.delete(id);
  }

  async approve(id: number, substituteActorId?: number, reviewerId?: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('请假记录不存在');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('只有待审批的请假可以审批');
    }

    const finalSubstituteId = substituteActorId || existing.substituteActorId;

    await this.repo.update(id, {
      status: LeaveStatus.APPROVED,
      substituteActorId: finalSubstituteId,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
    const approved = await this.repo.findOne({ where: { id } });

    if (reviewerId !== undefined && approved) {
      const reviewer = await this.userRepo.findOne({ where: { id: reviewerId } });
      const reviewerName = reviewer?.displayName || reviewer?.username || `用户#${reviewerId}`;

      const actor = await this.userRepo.findOne({ where: { id: existing.actorId } });
      const actorName = actor?.displayName || actor?.username || `用户#${existing.actorId}`;

      let substituteName: string | undefined;
      if (finalSubstituteId) {
        const sub = await this.userRepo.findOne({ where: { id: finalSubstituteId } });
        substituteName = sub?.displayName || sub?.username || `用户#${finalSubstituteId}`;
      }

      let roleName: string | undefined;
      if (existing.roleId) {
        const role = await this.roleRepo.findOne({ where: { id: existing.roleId } });
        roleName = role?.characterName;
      }

      await this.auditLogsService.log({
        action: AuditAction.APPROVE_LEAVE,
        module: AuditModule.LEAVE,
        operatorId: reviewerId,
        operatorName: reviewerName,
        targetUserId: existing.actorId,
        targetUsername: actorName,
        targetId: id,
        targetType: 'leave',
        detail: `批准 ${actorName} 的请假申请${finalSubstituteId ? `，替补：${substituteName}` : ''}`,
        metadata: { leave: approved, substituteActorId: finalSubstituteId, substituteName },
      });

      this.notificationsService.notifyLeaveApproved(
        id,
        existing.actorId,
        reviewerName,
        substituteName,
        reviewerId,
      ).catch(() => {});

      if (finalSubstituteId && finalSubstituteId !== existing.actorId) {
        this.notificationsService.notifyLeaveSubstituteAssigned(
          id,
          finalSubstituteId,
          actorName,
          existing.startDate,
          existing.endDate,
          roleName,
          reviewerId,
        ).catch(() => {});

        await this.auditLogsService.log({
          action: AuditAction.UPDATE_LEAVE_SUBSTITUTE,
          module: AuditModule.LEAVE,
          operatorId: reviewerId,
          operatorName: reviewerName,
          targetUserId: finalSubstituteId,
          targetUsername: substituteName,
          targetId: id,
          targetType: 'leave',
          detail: `为请假申请安排替补演员：${substituteName}`,
          metadata: { leaveId: id, substituteActorId: finalSubstituteId, substituteName },
        });
      }

      await this.adjustRehearsalParticipants(existing, finalSubstituteId, reviewerId, reviewerName);
    }

    return approved;
  }

  async reject(id: number, rejectionReason: string, reviewerId?: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('请假记录不存在');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('只有待审批的请假可以审批');
    }

    await this.repo.update(id, {
      status: LeaveStatus.REJECTED,
      rejectionReason,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
    const rejected = await this.repo.findOne({ where: { id } });

    if (reviewerId !== undefined && rejected) {
      const reviewer = await this.userRepo.findOne({ where: { id: reviewerId } });
      const reviewerName = reviewer?.displayName || reviewer?.username || `用户#${reviewerId}`;

      const actor = await this.userRepo.findOne({ where: { id: existing.actorId } });
      const actorName = actor?.displayName || actor?.username || `用户#${existing.actorId}`;

      await this.auditLogsService.log({
        action: AuditAction.REJECT_LEAVE,
        module: AuditModule.LEAVE,
        operatorId: reviewerId,
        operatorName: reviewerName,
        targetUserId: existing.actorId,
        targetUsername: actorName,
        targetId: id,
        targetType: 'leave',
        detail: `拒绝 ${actorName} 的请假申请，原因：${rejectionReason}`,
        metadata: { leave: rejected, rejectionReason },
      });

      this.notificationsService.notifyLeaveRejected(
        id,
        existing.actorId,
        reviewerName,
        rejectionReason,
        reviewerId,
      ).catch(() => {});
    }

    return rejected;
  }

  private async adjustRehearsalParticipants(
    leave: LeaveRequest,
    substituteActorId: number | undefined,
    operatorId: number,
    operatorName: string,
  ) {
    const allRehearsals = await this.rehearsalRepo.find();
    const affectedRehearsals = allRehearsals.filter((r) =>
      this.isDateOverlap(leave.startDate, leave.endDate, r.startTime, r.endTime) &&
      r.participantIds?.includes(leave.actorId),
    );

    for (const rehearsal of affectedRehearsals) {
      const participantIds = [...(rehearsal.participantIds || [])];
      const actorIndex = participantIds.indexOf(leave.actorId);

      if (actorIndex > -1) {
        if (substituteActorId && !participantIds.includes(substituteActorId)) {
          participantIds[actorIndex] = substituteActorId;
        }

        await this.rehearsalRepo.update(rehearsal.id, { participantIds });

        const attendance = rehearsal.attendance || {};
        const newAttendance = { ...attendance };
        if (newAttendance[String(leave.actorId)]) {
          newAttendance[String(leave.actorId)] = {
            ...newAttendance[String(leave.actorId)],
            status: 'absent',
            absentReason: `请假（${leave.type}）`,
          };
        }
        if (substituteActorId && !newAttendance[String(substituteActorId)]) {
          newAttendance[String(substituteActorId)] = {
            status: null,
            absentReason: undefined,
          };
        }
        await this.rehearsalRepo.update(rehearsal.id, { attendance: newAttendance });

        this.notificationsService.notifyRehearsalChange(
          rehearsal.id,
          'updated',
          [`参与人调整：请假替补`],
          operatorId,
        ).catch(() => {});
      }
    }
  }

  async getActiveLeavesForDate(date: Date): Promise<LeaveRequest[]> {
    const allLeaves = await this.repo.find({
      where: { status: LeaveStatus.APPROVED },
    });
    return allLeaves.filter((l) => date >= l.startDate && date <= l.endDate);
  }

  async getActiveLeavesForDateRange(start: Date, end: Date): Promise<LeaveRequest[]> {
    const allLeaves = await this.repo.find({
      where: { status: LeaveStatus.APPROVED },
    });
    return allLeaves.filter((l) => this.isDateOverlap(l.startDate, l.endDate, start, end));
  }

  private isDateOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 <= end2 && end1 >= start2;
  }

  private async enrichWithUserInfo(leaves: LeaveRequest[]): Promise<any[]> {
    const userIds = new Set<number>();
    leaves.forEach((l) => {
      userIds.add(l.actorId);
      if (l.substituteActorId) userIds.add(l.substituteActorId);
      if (l.reviewedBy) userIds.add(l.reviewedBy);
      if (l.createdBy) userIds.add(l.createdBy);
    });

    const users = await this.userRepo.findByIds(Array.from(userIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const roleIds = new Set<number>();
    leaves.forEach((l) => {
      if (l.roleId) roleIds.add(l.roleId);
    });

    const roles = await this.roleRepo.findByIds(Array.from(roleIds));
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    return leaves.map((l) => ({
      ...l,
      actorName: userMap.get(l.actorId)?.displayName || userMap.get(l.actorId)?.username,
      substituteActorName: l.substituteActorId
        ? userMap.get(l.substituteActorId)?.displayName || userMap.get(l.substituteActorId)?.username
        : null,
      reviewerName: l.reviewedBy
        ? userMap.get(l.reviewedBy)?.displayName || userMap.get(l.reviewedBy)?.username
        : null,
      creatorName: l.createdBy
        ? userMap.get(l.createdBy)?.displayName || userMap.get(l.createdBy)?.username
        : null,
      roleName: l.roleId ? roleMap.get(l.roleId)?.characterName : null,
    }));
  }

  async getStatistics() {
    const allLeaves = await this.repo.find();
    const total = allLeaves.length;
    const pending = allLeaves.filter((l) => l.status === LeaveStatus.PENDING).length;
    const approved = allLeaves.filter((l) => l.status === LeaveStatus.APPROVED).length;
    const rejected = allLeaves.filter((l) => l.status === LeaveStatus.REJECTED).length;

    const sickCount = allLeaves.filter((l) => l.type === LeaveType.SICK).length;
    const personalCount = allLeaves.filter((l) => l.type === LeaveType.PERSONAL).length;
    const otherCount = allLeaves.filter((l) => l.type === LeaveType.OTHER).length;

    const now = new Date();
    const activeLeaves = allLeaves.filter(
      (l) => l.status === LeaveStatus.APPROVED && now >= l.startDate && now <= l.endDate,
    );
    const activeActors = new Set(activeLeaves.map((l) => l.actorId));

    return {
      total,
      pending,
      approved,
      rejected,
      byType: {
        sick: sickCount,
        personal: personalCount,
        other: otherCount,
      },
      activeLeaves: activeLeaves.length,
      activeActorsOnLeave: activeActors.size,
    };
  }

  async getMyLeaves(userId: number, status?: LeaveStatus) {
    return this.findAll({ actorId: userId, status });
  }

  async getPendingLeaves() {
    return this.findAll({ status: LeaveStatus.PENDING });
  }
}
