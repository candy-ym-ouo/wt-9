import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LeaveRequest, LeaveStatus, LeaveType, CastRole, User } from '../entities';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(LeaveRequest)
    private repo: Repository<LeaveRequest>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
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
    return this.repo.save(item);
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

  async update(id: number, data: Partial<LeaveRequest>) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('请假记录不存在');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('只有待审批的请假可以修改');
    }

    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('请假记录不存在');
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

    await this.repo.update(id, {
      status: LeaveStatus.APPROVED,
      substituteActorId: substituteActorId || existing.substituteActorId,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
    return this.repo.findOne({ where: { id } });
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
    return this.repo.findOne({ where: { id } });
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
}
