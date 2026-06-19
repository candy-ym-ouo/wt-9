import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { Rehearsal, User } from '../entities';

export interface ConflictInfo {
  hasConflict: boolean;
  timeConflicts: Rehearsal[];
  participantConflicts: Array<{
    userId: number;
    userName?: string;
    conflictingRehearsals: Rehearsal[];
  }>;
}

@Injectable()
export class RehearsalsService {
  constructor(
    @InjectRepository(Rehearsal)
    private repo: Repository<Rehearsal>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
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
}
