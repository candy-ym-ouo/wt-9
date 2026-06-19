import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(params: {
    action: string;
    operatorId: number;
    operatorName?: string;
    targetUserId?: number;
    targetUsername?: string;
    detail?: string;
  }) {
    const entry = this.auditLogRepo.create(params);
    return this.auditLogRepo.save(entry);
  }

  async findAll(params?: { targetUserId?: number; action?: string; limit?: number; offset?: number }) {
    const qb = this.auditLogRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (params?.targetUserId) {
      qb.andWhere('log.targetUserId = :targetUserId', { targetUserId: params.targetUserId });
    }
    if (params?.action) {
      qb.andWhere('log.action = :action', { action: params.action });
    }
    if (params?.limit) {
      qb.limit(params.limit);
    }
    if (params?.offset) {
      qb.offset(params.offset);
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    return this.auditLogRepo.findOne({ where: { id } });
  }
}
