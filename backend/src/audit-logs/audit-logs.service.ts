import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { AuditLog, AuditModule } from '../entities';

export interface CreateAuditLogParams {
  action: string;
  module?: string;
  operatorId: number;
  operatorName?: string;
  targetUserId?: number;
  targetUsername?: string;
  targetId?: number;
  targetType?: string;
  detail?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogQueryParams {
  targetUserId?: number;
  operatorId?: number;
  action?: string;
  module?: string;
  targetType?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(params: CreateAuditLogParams) {
    const { metadata, ...rest } = params;
    const entry = this.auditLogRepo.create({
      ...rest,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
    return this.auditLogRepo.save(entry);
  }

  async findAll(params?: AuditLogQueryParams) {
    const qb = this.auditLogRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (params?.targetUserId) {
      qb.andWhere('log.targetUserId = :targetUserId', { targetUserId: params.targetUserId });
    }
    if (params?.operatorId) {
      qb.andWhere('log.operatorId = :operatorId', { operatorId: params.operatorId });
    }
    if (params?.action) {
      qb.andWhere('log.action = :action', { action: params.action });
    }
    if (params?.module) {
      qb.andWhere('log.module = :module', { module: params.module });
    }
    if (params?.targetType) {
      qb.andWhere('log.targetType = :targetType', { targetType: params.targetType });
    }
    if (params?.keyword) {
      const kw = `%${params.keyword}%`;
      qb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('log.detail LIKE :kw', { kw })
            .orWhere('log.operatorName LIKE :kw', { kw })
            .orWhere('log.targetUsername LIKE :kw', { kw });
        }),
      );
    }
    if (params?.dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: new Date(params.dateFrom) });
    }
    if (params?.dateTo) {
      const endDate = new Date(params.dateTo);
      endDate.setHours(23, 59, 59, 999);
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: endDate });
    }
    if (params?.limit) {
      qb.limit(params.limit);
    }
    if (params?.offset) {
      qb.offset(params.offset);
    }

    const [items, total] = await qb.getManyAndCount();
    const enriched = items.map((item) => ({
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null,
    }));

    return { items, total, enriched };
  }

  async findOne(id: number) {
    const log = await this.auditLogRepo.findOne({ where: { id } });
    if (log && log.metadata) {
      return { ...log, metadata: JSON.parse(log.metadata) };
    }
    return log;
  }
}
