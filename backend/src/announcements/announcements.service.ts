import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull } from 'typeorm';
import {
  Announcement,
  AnnouncementCategory,
  AnnouncementStatus,
  UserRole,
  User,
  Material,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

interface SearchFilters {
  category?: AnnouncementCategory;
  status?: AnnouncementStatus;
  keyword?: string;
  tags?: string;
  createdBy?: number;
  dateFrom?: string;
  dateTo?: string;
  userRole?: UserRole;
  includeExpiredPinned?: boolean;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private repo: Repository<Announcement>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    data: Partial<Announcement>,
    operatorId: number,
    operatorName: string,
  ) {
    const item = this.repo.create({
      ...data,
      createdBy: operatorId,
      updatedBy: operatorId,
      viewCount: 0,
      visibleRoles: data.visibleRoles || [],
      attachmentIds: data.attachmentIds || [],
      tags: data.tags || [],
      status: data.status || AnnouncementStatus.DRAFT,
      isPinned: data.isPinned || false,
    });

    if (data.status === AnnouncementStatus.PUBLISHED && !data.publishedAt) {
      item.publishedAt = new Date();
    }

    const saved = await this.repo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ANNOUNCEMENT,
      module: AuditModule.ANNOUNCEMENT,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'announcement',
      detail: `创建公告「${saved.title}」`,
      metadata: {
        title: saved.title,
        category: saved.category,
        status: saved.status,
        isPinned: saved.isPinned,
      },
    });

    if (saved.status === AnnouncementStatus.PUBLISHED) {
      await this.auditLogsService.log({
        action: AuditAction.PUBLISH_ANNOUNCEMENT,
        module: AuditModule.ANNOUNCEMENT,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'announcement',
        detail: `发布公告「${saved.title}」`,
        metadata: { title: saved.title },
      });
    }

    return this.findOne(saved.id);
  }

  async findAll(filters: SearchFilters = {}) {
    const query = this.buildQuery(filters);
    const announcements = await query.getMany();
    return this.enrichAll(announcements);
  }

  async findOne(id: number, incrementView = false) {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) return null;

    if (incrementView) {
      await this.repo.increment({ id }, 'viewCount', 1);
      announcement.viewCount = (announcement.viewCount || 0) + 1;
    }

    const enriched = await this.enrichAll([announcement]);
    return enriched[0];
  }

  async update(
    id: number,
    data: Partial<Announcement>,
    operatorId: number,
    operatorName: string,
  ) {
    const old = await this.repo.findOne({ where: { id } });
    if (!old) return null;

    const updates: Partial<Announcement> = {
      ...data,
      updatedBy: operatorId,
    };

    if (
      data.status === AnnouncementStatus.PUBLISHED &&
      old.status !== AnnouncementStatus.PUBLISHED &&
      !old.publishedAt
    ) {
      updates.publishedAt = new Date();
    }

    await this.repo.update(id, updates);
    const updated = await this.findOne(id);

    const changes: string[] = [];
    if (data.title && data.title !== old.title) {
      changes.push(`标题: ${old.title} → ${data.title}`);
    }
    if (data.category && data.category !== old.category) {
      changes.push(`分类: ${old.category} → ${data.category}`);
    }
    if (data.status && data.status !== old.status) {
      changes.push(`状态: ${old.status} → ${data.status}`);
    }
    if (data.isPinned !== undefined && data.isPinned !== old.isPinned) {
      changes.push(`置顶: ${old.isPinned ? '是' : '否'} → ${data.isPinned ? '是' : '否'}`);
    }
    if (data.pinExpiresAt !== undefined) {
      const oldExp = old.pinExpiresAt ? new Date(old.pinExpiresAt).toLocaleDateString('zh-CN') : '无';
      const newExp = data.pinExpiresAt ? new Date(data.pinExpiresAt).toLocaleDateString('zh-CN') : '无';
      if (oldExp !== newExp) {
        changes.push(`置顶过期时间: ${oldExp} → ${newExp}`);
      }
    }
    if (data.visibleRoles) {
      changes.push(`可见角色变更`);
    }
    if (data.attachmentIds) {
      changes.push(`附件变更`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ANNOUNCEMENT,
      module: AuditModule.ANNOUNCEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'announcement',
      detail:
        changes.length > 0
          ? `更新公告「${old.title}」: ${changes.join('; ')}`
          : `更新公告「${old.title}」`,
      metadata: { old, new: data },
    });

    if (
      data.status === AnnouncementStatus.PUBLISHED &&
      old.status !== AnnouncementStatus.PUBLISHED
    ) {
      await this.auditLogsService.log({
        action: AuditAction.PUBLISH_ANNOUNCEMENT,
        module: AuditModule.ANNOUNCEMENT,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'announcement',
        detail: `发布公告「${old.title}」`,
        metadata: { title: old.title },
      });
    }

    if (
      data.status === AnnouncementStatus.ARCHIVED &&
      old.status !== AnnouncementStatus.ARCHIVED
    ) {
      await this.auditLogsService.log({
        action: AuditAction.ARCHIVE_ANNOUNCEMENT,
        module: AuditModule.ANNOUNCEMENT,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'announcement',
        detail: `归档公告「${old.title}」`,
        metadata: { title: old.title },
      });
    }

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const announcement = await this.repo.findOne({ where: { id } });
    if (announcement) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_ANNOUNCEMENT,
        module: AuditModule.ANNOUNCEMENT,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'announcement',
        detail: `删除公告「${announcement.title}」`,
        metadata: { title: announcement.title, category: announcement.category },
      });
    }
    return this.repo.delete(id);
  }

  async publish(id: number, operatorId: number, operatorName: string) {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) return null;

    await this.repo.update(id, {
      status: AnnouncementStatus.PUBLISHED,
      publishedAt: announcement.publishedAt || new Date(),
      updatedBy: operatorId,
    });

    await this.auditLogsService.log({
      action: AuditAction.PUBLISH_ANNOUNCEMENT,
      module: AuditModule.ANNOUNCEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'announcement',
      detail: `发布公告「${announcement.title}」`,
      metadata: { title: announcement.title },
    });

    return this.findOne(id);
  }

  async archive(id: number, operatorId: number, operatorName: string) {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) return null;

    await this.repo.update(id, {
      status: AnnouncementStatus.ARCHIVED,
      updatedBy: operatorId,
    });

    await this.auditLogsService.log({
      action: AuditAction.ARCHIVE_ANNOUNCEMENT,
      module: AuditModule.ANNOUNCEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'announcement',
      detail: `归档公告「${announcement.title}」`,
      metadata: { title: announcement.title },
    });

    return this.findOne(id);
  }

  async pin(
    id: number,
    pinExpiresAt: Date | null,
    operatorId: number,
    operatorName: string,
  ) {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) return null;

    await this.repo.update(id, {
      isPinned: true,
      pinExpiresAt,
      updatedBy: operatorId,
    });

    await this.auditLogsService.log({
      action: AuditAction.PIN_ANNOUNCEMENT,
      module: AuditModule.ANNOUNCEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'announcement',
      detail: pinExpiresAt
        ? `置顶公告「${announcement.title}」，过期时间: ${new Date(pinExpiresAt).toLocaleDateString('zh-CN')}`
        : `置顶公告「${announcement.title}」`,
      metadata: { title: announcement.title, pinExpiresAt },
    });

    return this.findOne(id);
  }

  async unpin(id: number, operatorId: number, operatorName: string) {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) return null;

    await this.repo.update(id, {
      isPinned: false,
      pinExpiresAt: null,
      updatedBy: operatorId,
    });

    await this.auditLogsService.log({
      action: AuditAction.UNPIN_ANNOUNCEMENT,
      module: AuditModule.ANNOUNCEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'announcement',
      detail: `取消置顶公告「${announcement.title}」`,
      metadata: { title: announcement.title },
    });

    return this.findOne(id);
  }

  async getStats() {
    const total = await this.repo.count();

    const statusCounts = await this.repo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status')
      .getRawMany();

    const categoryCounts = await this.repo
      .createQueryBuilder('a')
      .select('a.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.category')
      .getRawMany();

    const pinnedCount = await this.repo.count({ where: { isPinned: true } });

    const now = new Date();
    const activePinnedCount = await this.repo
      .createQueryBuilder('a')
      .where('a.isPinned = true')
      .andWhere('(a.pinExpiresAt IS NULL OR a.pinExpiresAt > :now)', { now })
      .getCount();

    return {
      total,
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: parseInt(s.count, 10),
      })),
      categoryCounts: categoryCounts.map((c) => ({
        category: c.category,
        count: parseInt(c.count, 10),
      })),
      pinnedCount,
      activePinnedCount,
    };
  }

  private buildQuery(filters: SearchFilters) {
    const qb = this.repo.createQueryBuilder('a');

    if (filters.category) {
      qb.andWhere('a.category = :category', { category: filters.category });
    }
    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.createdBy !== undefined) {
      qb.andWhere('a.createdBy = :createdBy', { createdBy: filters.createdBy });
    }
    if (filters.keyword) {
      qb.andWhere('(a.title LIKE :keyword OR a.content LIKE :keyword)', {
        keyword: `%${filters.keyword}%`,
      });
    }
    if (filters.tags) {
      const tagList = filters.tags.split(',').map((t) => t.trim()).filter(Boolean);
      tagList.forEach((tag, idx) => {
        qb.andWhere(`JSON_EXTRACT(a.tags, "$") LIKE :tag${idx}`, {
          [`tag${idx}`]: `%${tag}%`,
        });
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      const from = filters.dateFrom
        ? new Date(filters.dateFrom)
        : new Date('1970-01-01');
      const to = filters.dateTo
        ? new Date(filters.dateTo + 'T23:59:59')
        : new Date('2999-12-31');
      qb.andWhere('a.createdAt BETWEEN :from AND :to', { from, to });
    }

    if (filters.userRole) {
      qb.andWhere(
        '(JSON_LENGTH(a.visibleRoles) = 0 OR JSON_EXTRACT(a.visibleRoles, "$") LIKE :rolePattern)',
        { rolePattern: `%"${filters.userRole}"%` },
      );
    }

    const now = new Date();
    qb.addSelect(
      `CASE WHEN a.isPinned = true AND (a.pinExpiresAt IS NULL OR a.pinExpiresAt > :now) THEN 1 ELSE 0 END`,
      'isActivePinned',
    );
    qb.setParameter('now', now);

    qb.orderBy({
      'isActivePinned': 'DESC',
      'a.isPinned': 'DESC',
      'a.publishedAt': 'DESC',
      'a.createdAt': 'DESC',
    });

    return qb;
  }

  private async enrichAll(announcements: Announcement[]) {
    const userIds = new Set<number>();
    const materialIds = new Set<number>();

    announcements.forEach((a) => {
      if (a.createdBy) userIds.add(a.createdBy);
      if (a.updatedBy) userIds.add(a.updatedBy);
      (a.attachmentIds || []).forEach((id) => materialIds.add(id));
    });

    const [users, materials] = await Promise.all([
      userIds.size > 0
        ? this.userRepo.findByIds(Array.from(userIds))
        : Promise.resolve([]),
      materialIds.size > 0
        ? this.materialRepo.findByIds(Array.from(materialIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const materialMap = new Map(materials.map((m) => [m.id, m]));

    const now = new Date();

    return announcements.map((a) => {
      const creator = a.createdBy ? userMap.get(a.createdBy) : null;
      const updater = a.updatedBy ? userMap.get(a.updatedBy) : null;
      const isPinExpired =
        a.isPinned && a.pinExpiresAt && new Date(a.pinExpiresAt) <= now;

      return {
        ...a,
        creatorName: creator?.displayName || creator?.username,
        updaterName: updater?.displayName || updater?.username,
        isPinExpired: !!isPinExpired,
        isActivePinned: a.isPinned && !isPinExpired,
        attachments: (a.attachmentIds || [])
          .map((id) => {
            const m = materialMap.get(id);
            return m
              ? {
                  id: m.id,
                  originalName: m.originalName,
                  storedName: m.storedName,
                  mimeType: m.mimeType,
                  size: m.size,
                }
              : null;
          })
          .filter(Boolean),
      };
    });
  }
}
