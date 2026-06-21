import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import {
  PerformanceReview,
  PerformanceReviewType,
  PerformanceReviewStatus,
  PerformanceReviewPriority,
  PerformanceReviewSeverity,
  Performance,
  CastRole,
  Material,
  User,
  Task,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface ReviewFilters {
  type?: PerformanceReviewType;
  status?: PerformanceReviewStatus;
  priority?: PerformanceReviewPriority;
  severity?: PerformanceReviewSeverity;
  performanceId?: number;
  dramaId?: number;
  roleId?: number;
  materialId?: number;
  actorId?: number;
  assigneeId?: number;
  reporterId?: number;
  createdBy?: number;
  keyword?: string;
  tags?: string;
  category?: string;
  dueFrom?: string;
  dueTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  includeFollowerOf?: number;
}

export interface ReviewStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  bySeverity: Record<string, number>;
}

@Injectable()
export class PerformanceReviewsService {
  constructor(
    @InjectRepository(PerformanceReview)
    private repo: Repository<PerformanceReview>,
    @InjectRepository(Performance)
    private performanceRepo: Repository<Performance>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    data: Partial<PerformanceReview>,
    operatorId: number,
    operatorName: string,
  ) {
    const review = this.repo.create({
      ...data,
      status: data.status || PerformanceReviewStatus.OPEN,
      statusHistory: data.status
        ? [
            {
              id: Date.now(),
              fromStatus: null,
              toStatus: data.status,
              userId: operatorId,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      createdBy: operatorId,
      reporterId: data.reporterId || operatorId,
    });

    const saved = await this.repo.save(review);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_PERFORMANCE_REVIEW,
      module: AuditModule.PERFORMANCE_REVIEW,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'performance_review',
      targetUserId: saved.assigneeId,
      detail: `创建演出复盘「${saved.title}」(${this.getTypeLabel(saved.type)})`,
      metadata: {
        title: saved.title,
        type: saved.type,
        priority: saved.priority,
        performanceId: saved.performanceId,
      },
    });

    return this.findOne(saved.id);
  }

  private getTypeLabel(type: PerformanceReviewType): string {
    const labels: Record<PerformanceReviewType, string> = {
      [PerformanceReviewType.ISSUE]: '场次问题',
      [PerformanceReviewType.ACTOR_FEEDBACK]: '演员反馈',
      [PerformanceReviewType.MATERIAL_GAP]: '素材缺失',
      [PerformanceReviewType.IMPROVEMENT]: '改进项',
    };
    return labels[type] || type;
  }

  async findAll(filters: ReviewFilters = {}) {
    const qb = this.buildQuery(filters);
    const reviews = await qb
      .orderBy({
        'review.priority': 'DESC',
        'review.createdAt': 'DESC',
      })
      .getMany();
    return this.enrichAll(reviews);
  }

  async findOne(id: number) {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) return null;
    const enriched = await this.enrichAll([review]);
    return enriched[0];
  }

  async update(
    id: number,
    data: Partial<PerformanceReview>,
    operatorId: number,
    operatorName: string,
  ) {
    const old = await this.repo.findOne({ where: { id } });
    if (!old) return null;

    const changes: string[] = [];
    if (data.title && data.title !== old.title) {
      changes.push(`标题: ${old.title} → ${data.title}`);
    }
    if (data.type && data.type !== old.type) {
      changes.push(`类型: ${this.getTypeLabel(old.type)} → ${this.getTypeLabel(data.type)}`);
    }
    if (data.priority && data.priority !== old.priority) {
      changes.push(`优先级: ${old.priority} → ${data.priority}`);
    }
    if (data.severity !== undefined && data.severity !== old.severity) {
      changes.push(`严重程度: ${old.severity || '无'} → ${data.severity || '无'}`);
    }
    if (data.status && data.status !== old.status) {
      changes.push(`状态: ${old.status} → ${data.status}`);
    }
    if (data.performanceId !== undefined && data.performanceId !== old.performanceId) {
      changes.push(`关联演出变更`);
    }

    const updateData: any = { ...data };

    if (data.status && data.status !== old.status) {
      const statusHistory = old.statusHistory || [];
      statusHistory.push({
        id: Date.now(),
        fromStatus: old.status,
        toStatus: data.status,
        userId: operatorId,
        createdAt: new Date().toISOString(),
      });
      updateData.statusHistory = statusHistory;

      if (
        data.status === PerformanceReviewStatus.RESOLVED ||
        data.status === PerformanceReviewStatus.CLOSED
      ) {
        updateData.resolvedAt = new Date();
      } else if (old.resolvedAt) {
        updateData.resolvedAt = null;
      }
    }

    await this.repo.update(id, updateData);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_PERFORMANCE_REVIEW,
      module: AuditModule.PERFORMANCE_REVIEW,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'performance_review',
      detail: changes.length > 0
        ? `更新演出复盘「${old.title}」: ${changes.join('; ')}`
        : `更新演出复盘「${old.title}」`,
      metadata: { old, new: data },
    });

    return this.findOne(id);
  }

  async updateStatus(
    id: number,
    status: PerformanceReviewStatus,
    operatorId: number,
    operatorName: string,
    remark?: string,
  ) {
    const old = await this.repo.findOne({ where: { id } });
    if (!old) return null;

    const statusHistory = old.statusHistory || [];
    statusHistory.push({
      id: Date.now(),
      fromStatus: old.status,
      toStatus: status,
      userId: operatorId,
      remark,
      createdAt: new Date().toISOString(),
    });

    const updateData: any = {
      status,
      statusHistory,
    };

    if (
      status === PerformanceReviewStatus.RESOLVED ||
      status === PerformanceReviewStatus.CLOSED
    ) {
      updateData.resolvedAt = new Date();
    } else if (old.resolvedAt) {
      updateData.resolvedAt = null;
    }

    await this.repo.update(id, updateData);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_PERFORMANCE_REVIEW_STATUS,
      module: AuditModule.PERFORMANCE_REVIEW,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'performance_review',
      detail: `更新演出复盘「${old.title}」状态: ${old.status} → ${status}`,
      metadata: { oldStatus: old.status, newStatus: status, remark },
    });

    return this.findOne(id);
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const review = await this.repo.findOne({ where: { id } });
    if (review) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_PERFORMANCE_REVIEW,
        module: AuditModule.PERFORMANCE_REVIEW,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'performance_review',
        detail: `删除演出复盘「${review.title}」`,
        metadata: {
          title: review.title,
          type: review.type,
          performanceId: review.performanceId,
        },
      });
    }
    return this.repo.delete(id);
  }

  async addComment(
    id: number,
    content: string,
    operatorId: number,
    operatorName: string,
  ) {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) return null;

    const comments = review.comments || [];
    comments.push({
      id: Date.now(),
      userId: operatorId,
      content,
      createdAt: new Date().toISOString(),
    });

    await this.repo.update(id, { comments });

    await this.auditLogsService.log({
      action: AuditAction.ADD_PERFORMANCE_REVIEW_COMMENT,
      module: AuditModule.PERFORMANCE_REVIEW,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'performance_review',
      detail: `在演出复盘「${review.title}」添加评论`,
      metadata: { reviewId: id, content },
    });

    return this.findOne(id);
  }

  async getStats(filters: ReviewFilters = {}): Promise<ReviewStats> {
    const qb = this.buildQuery(filters);
    const reviews = await qb.getMany();

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    reviews.forEach((r) => {
      byType[r.type] = (byType[r.type] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byPriority[r.priority] = (byPriority[r.priority] || 0) + 1;
      if (r.severity) {
        bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
      }
    });

    return {
      total: reviews.length,
      byType,
      byStatus,
      byPriority,
      bySeverity,
    };
  }

  async getByPerformance(performanceId: number) {
    const reviews = await this.repo.find({
      where: { performanceId },
      order: { createdAt: 'DESC' },
    });
    return this.enrichAll(reviews);
  }

  async getByDrama(dramaId: number) {
    const reviews = await this.repo.find({
      where: { dramaId },
      order: { createdAt: 'DESC' },
    });
    return this.enrichAll(reviews);
  }

  async getAllCategories(): Promise<string[]> {
    const reviews = await this.repo.find({ select: ['category'] });
    const categorySet = new Set<string>();
    reviews.forEach((r) => {
      if (r.category) categorySet.add(r.category);
    });
    return Array.from(categorySet).sort();
  }

  async getAllTags(): Promise<string[]> {
    const reviews = await this.repo.find();
    const tagSet = new Set<string>();
    reviews.forEach((r) => {
      if (r.tags) r.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }

  private buildQuery(filters: ReviewFilters) {
    const qb = this.repo.createQueryBuilder('review');
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (filters.type) {
      conditions.push('review.type = :type');
      params.type = filters.type;
    }

    if (filters.status) {
      conditions.push('review.status = :status');
      params.status = filters.status;
    }

    if (filters.priority) {
      conditions.push('review.priority = :priority');
      params.priority = filters.priority;
    }

    if (filters.severity) {
      conditions.push('review.severity = :severity');
      params.severity = filters.severity;
    }

    if (filters.performanceId) {
      conditions.push('review.performanceId = :performanceId');
      params.performanceId = filters.performanceId;
    }

    if (filters.dramaId) {
      conditions.push('review.dramaId = :dramaId');
      params.dramaId = filters.dramaId;
    }

    if (filters.assigneeId) {
      conditions.push('review.assigneeId = :assigneeId');
      params.assigneeId = filters.assigneeId;
    }

    if (filters.reporterId) {
      conditions.push('review.reporterId = :reporterId');
      params.reporterId = filters.reporterId;
    }

    if (filters.createdBy) {
      conditions.push('review.createdBy = :createdBy');
      params.createdBy = filters.createdBy;
    }

    if (filters.category) {
      conditions.push('review.category = :category');
      params.category = filters.category;
    }

    if (filters.keyword) {
      conditions.push('(review.title LIKE :kw OR review.description LIKE :kw OR review.resolution LIKE :kw)');
      params.kw = `%${filters.keyword}%`;
    }

    if (filters.roleId) {
      conditions.push('review.relatedRoleIds LIKE :roleId');
      params.roleId = `%${filters.roleId}%`;
    }

    if (filters.materialId) {
      conditions.push('review.relatedMaterialIds LIKE :materialId');
      params.materialId = `%${filters.materialId}%`;
    }

    if (filters.actorId) {
      conditions.push('review.relatedActorIds LIKE :actorId');
      params.actorId = `%${filters.actorId}%`;
    }

    if (filters.dueFrom) {
      conditions.push('review.dueDate >= :dueFrom');
      params.dueFrom = new Date(filters.dueFrom);
    }

    if (filters.dueTo) {
      conditions.push('review.dueDate <= :dueTo');
      params.dueTo = new Date(filters.dueTo);
    }

    if (filters.createdAtFrom) {
      conditions.push('review.createdAt >= :createdAtFrom');
      params.createdAtFrom = new Date(filters.createdAtFrom);
    }

    if (filters.createdAtTo) {
      conditions.push('review.createdAt <= :createdAtTo');
      params.createdAtTo = new Date(filters.createdAtTo);
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    if (filters.tags) {
      const tagList = filters.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const tagConditions: string[] = [];
        tagList.forEach((tag, i) => {
          tagConditions.push(`review.tags LIKE :tag${i}`);
          params[`tag${i}`] = `%${tag}%`;
        });
        qb.andWhere(`(${tagConditions.join(' OR ')})`, params);
      }
    }

    return qb;
  }

  private async enrichAll(reviews: PerformanceReview[]) {
    const result: any[] = [];

    const performanceIds = new Set<number>();
    const roleIds = new Set<number>();
    const materialIds = new Set<number>();
    const userIds = new Set<number>();
    const taskIds = new Set<number>();

    reviews.forEach((r) => {
      if (r.performanceId) performanceIds.add(r.performanceId);
      (r.relatedRoleIds || []).forEach((id) => roleIds.add(id));
      (r.relatedMaterialIds || []).forEach((id) => materialIds.add(id));
      (r.relatedActorIds || []).forEach((id) => userIds.add(id));
      (r.relatedTaskIds || []).forEach((id) => taskIds.add(id));
      if (r.assigneeId) userIds.add(r.assigneeId);
      if (r.reporterId) userIds.add(r.reporterId);
      if (r.createdBy) userIds.add(r.createdBy);
      (r.followerIds || []).forEach((id) => userIds.add(id));
      (r.comments || []).forEach((c) => userIds.add(c.userId));
    });

    const [performances, roles, materials, users, tasks] = await Promise.all([
      performanceIds.size > 0
        ? this.performanceRepo.findBy({ id: In(Array.from(performanceIds)) })
        : Promise.resolve([]),
      roleIds.size > 0
        ? this.roleRepo.findBy({ id: In(Array.from(roleIds)) })
        : Promise.resolve([]),
      materialIds.size > 0
        ? this.materialRepo.findBy({ id: In(Array.from(materialIds)) })
        : Promise.resolve([]),
      userIds.size > 0
        ? this.userRepo.findByIds(Array.from(userIds))
        : Promise.resolve([]),
      taskIds.size > 0
        ? this.taskRepo.findBy({ id: In(Array.from(taskIds)) })
        : Promise.resolve([]),
    ]);

    const performanceMap = new Map(performances.map((p) => [p.id, p]));
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    const materialMap = new Map(materials.map((m) => [m.id, m]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    for (const review of reviews) {
      const enriched = {
        ...review,
        performance: performanceMap.get(review.performanceId!) || null,
        relatedRoles: (review.relatedRoleIds || [])
          .map((id) => roleMap.get(id))
          .filter(Boolean),
        relatedMaterials: (review.relatedMaterialIds || [])
          .map((id) => materialMap.get(id))
          .filter(Boolean),
        relatedActors: (review.relatedActorIds || [])
          .map((id) => {
            const u = userMap.get(id);
            return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
          })
          .filter(Boolean),
        relatedTasks: (review.relatedTaskIds || [])
          .map((id) => taskMap.get(id))
          .filter(Boolean),
        assignee: review.assigneeId
          ? (() => {
              const u = userMap.get(review.assigneeId);
              return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
            })()
          : null,
        reporter: review.reporterId
          ? (() => {
              const u = userMap.get(review.reporterId);
              return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
            })()
          : null,
        createdByUser: review.createdBy
          ? (() => {
              const u = userMap.get(review.createdBy);
              return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
            })()
          : null,
        followers: (review.followerIds || [])
          .map((id) => {
            const u = userMap.get(id);
            return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
          })
          .filter(Boolean),
        commentsWithUsers: (review.comments || []).map((c) => ({
          ...c,
          user: (() => {
            const u = userMap.get(c.userId);
            return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
          })(),
        })),
      };
      result.push(enriched);
    }

    return result;
  }

  async searchReviews(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
    dramaIds?: number[],
  ) {
    const qb = this.repo.createQueryBuilder('review');
    const conditions: string[] = [];
    const params: any = {};

    if (dramaIds && dramaIds.length > 0) {
      conditions.push('review.dramaId IN (:...dramaIds)');
      params.dramaIds = dramaIds;
    }

    if (likeQuery) {
      conditions.push('(review.title LIKE :q OR review.description LIKE :q OR review.resolution LIKE :q OR review.category LIKE :q)');
      params.q = likeQuery;
    }

    if (tags && tags.length > 0) {
      const tagConditions: string[] = [];
      tags.forEach((tag, i) => {
        tagConditions.push(`review.tags LIKE :tag${i}`);
        params[`tag${i}`] = `%${tag}%`;
      });
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    if (dateRange?.from) {
      conditions.push(`review.${dateField} >= :dateFrom`);
      params.dateFrom = dateRange.from;
    }
    if (dateRange?.to) {
      conditions.push(`review.${dateField} <= :dateTo`);
      params.dateTo = dateRange.to;
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    return qb.getMany();
  }
}
