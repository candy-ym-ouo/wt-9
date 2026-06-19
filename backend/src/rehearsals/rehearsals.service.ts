import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { Rehearsal, User, CastRole, LeaveRequest, LeaveStatus } from '../entities';
import { LeavesService } from '../leaves/leaves.service';

export interface ConflictInfo {
  hasConflict: boolean;
  timeConflicts: Rehearsal[];
  participantConflicts: Array<{
    userId: number;
    userName?: string;
    conflictingRehearsals: Rehearsal[];
  }>;
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
    private leavesService: LeavesService,
  ) {}

  async checkConflicts(
    startTime: Date,
    endTime: Date,
    participantIds: number[] = [],
    excludeId?: number,
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

    return {
      hasConflict: timeConflicts.length > 0 || participantConflicts.length > 0,
      timeConflicts,
      participantConflicts,
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

  async create(data: Partial<Rehearsal>) {
    const startTime = data.startTime instanceof Date ? data.startTime : new Date(data.startTime!);
    const endTime = data.endTime instanceof Date ? data.endTime : new Date(data.endTime!);

    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const item = this.repo.create(data);
    return this.repo.save(item);
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

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Rehearsal>) {
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

    await this.repo.update(id, {
      ...data,
      startTime,
      endTime,
      participantIds,
    });
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
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
      );
      result.push({
        ...r,
        hasConflict: conflict.hasConflict,
        timeConflicts: conflict.timeConflicts,
        participantConflicts: conflict.participantConflicts,
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

    const result: ParticipantInfo[] = [];
    for (const userId of participantIds) {
      const user = userMap.get(userId);
      const leave = activeLeaves.find((l) => l.actorId === userId);
      const role = roleByActor.get(userId);

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

      result.push({
        ...r,
        participants,
        onLeaveCount,
        withSubstituteCount,
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
}
