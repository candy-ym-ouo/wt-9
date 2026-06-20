import { Injectable, NotFoundException, ForbiddenException, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Annotation, AnnotationVersion, VersionAction, UserRole, Material, User, AuditAction, AuditModule, SubscriptionTargetType } from '../entities';
import { NotificationsService } from '../notifications/notifications.service';
import { DramasService } from '../dramas/dramas.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private repo: Repository<Annotation>,
    @InjectRepository(AnnotationVersion)
    private versionRepo: Repository<AnnotationVersion>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => DramasService))
    private dramasService: DramasService,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => SubscriptionsService))
    private subscriptionsService: SubscriptionsService,
  ) {}

  private async createVersion(
    annotation: Annotation,
    action: VersionAction,
    actionBy: number,
  ) {
    const version = this.versionRepo.create({
      annotationId: annotation.id,
      dramaId: annotation.dramaId,
      scriptContent: annotation.scriptContent,
      note: annotation.note,
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      tag: annotation.tag,
      tagColor: annotation.tagColor,
      sceneNumber: annotation.sceneNumber,
      createdBy: annotation.createdBy,
      action,
      actionBy,
    });
    return this.versionRepo.save(version);
  }

  canModify(annotation: Annotation, userId: number, userRole: UserRole): boolean {
    if (userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR) {
      return true;
    }
    return annotation.createdBy === userId;
  }

  private async validateMaterialIds(materialIds: number[], dramaId?: number): Promise<number[]> {
    const uniqueIds = Array.from(new Set(materialIds));
    if (uniqueIds.length === 0) return uniqueIds;
    const where: any = { id: In(uniqueIds) };
    if (dramaId) where.dramaId = dramaId;
    const materials = await this.materialRepo.find({ where });
    if (materials.length !== uniqueIds.length) {
      const foundIds = materials.map((m) => m.id);
      const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(`素材ID不存在或不属于当前剧目: ${missingIds.join(', ')}`);
    }
    return uniqueIds;
  }

  async create(data: Partial<Annotation>, dramaId: number, userId: number, username: string) {
    await this.dramasService.checkAccess(dramaId, userId, ['viewer', 'actor', 'crew']);
    const materialIds = data.materialIds ? await this.validateMaterialIds(data.materialIds, dramaId) : [];
    const item = this.repo.create({ ...data, dramaId, materialIds });
    const saved = await this.repo.save(item);
    await this.createVersion(saved, VersionAction.CREATE, userId);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ANNOTATION,
      module: AuditModule.ANNOTATION,
      operatorId: userId,
      operatorName: username,
      targetId: saved.id,
      targetType: 'annotation',
      detail: `在剧目 #${dramaId} 创建批注`,
      metadata: { dramaId, sceneNumber: saved.sceneNumber, tag: saved.tag },
    });

    if (data.note && data.createdBy && data.createdBy !== userId) {
      const replier = await this.userRepo.findOne({ where: { id: userId } });
      const replierName = replier?.displayName || replier?.username || `用户#${userId}`;
      this.notificationsService.notifyAnnotationReply(
        saved.id,
        data.note,
        userId,
        replierName,
      ).catch(() => {});
    }

    const contentPreview = saved.scriptContent.length > 50
      ? saved.scriptContent.substring(0, 50) + '...'
      : saved.scriptContent;

    const targetUserIds = saved.createdBy && saved.createdBy !== userId ? [saved.createdBy] : [];
    if (targetUserIds.length > 0) {
      this.notificationsService.notifyAnnotationUpdate(
        saved.id,
        'created',
        targetUserIds,
        userId,
        username,
      ).catch(() => {});
    }

    this.subscriptionsService.notifySubscribers(
      SubscriptionTargetType.ANNOTATION,
      saved.id,
      'created',
      '新批注创建',
      `新批注已创建\n内容：${contentPreview}`,
      { annotation: saved, dramaId },
      userId,
    ).catch(() => {});

    return saved;
  }

  async findAll(dramaId: number | undefined, userId: number) {
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
      return this.repo.find({ where: { dramaId }, order: { createdAt: 'DESC' } });
    } else {
      const dramaIds = await this.dramasService.getUserDramaIds(userId);
      if (dramaIds.length === 0) return [];
      return this.repo.find({ where: { dramaId: In(dramaIds) }, order: { createdAt: 'DESC' } });
    }
  }

  async findAllCrossDrama(userId: number) {
    const dramaIds = await this.dramasService.getUserDramaIds(userId);
    if (dramaIds.length === 0) return [];
    return this.repo.find({ where: { dramaId: In(dramaIds) }, order: { createdAt: 'DESC' } });
  }

  async findByScene(sceneNumber: number, dramaId: number | undefined, userId: number) {
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
      return this.repo.find({ where: { dramaId, sceneNumber }, order: { createdAt: 'DESC' } });
    } else {
      const dramaIds = await this.dramasService.getUserDramaIds(userId);
      if (dramaIds.length === 0) return [];
      return this.repo.find({ where: { dramaId: In(dramaIds), sceneNumber }, order: { createdAt: 'DESC' } });
    }
  }

  async findGroupedByScene(dramaId: number | undefined, userId: number, searchQuery?: string) {
    let all: Annotation[];
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
      all = await this.repo.find({ where: { dramaId }, order: { sceneNumber: 'ASC', createdAt: 'DESC' } });
    } else {
      const dramaIds = await this.dramasService.getUserDramaIds(userId);
      if (dramaIds.length === 0) {
        all = [];
      } else {
        all = await this.repo.find({ where: { dramaId: In(dramaIds) }, order: { sceneNumber: 'ASC', createdAt: 'DESC' } });
      }
    }

    const filtered = searchQuery && searchQuery.trim()
      ? this.searchInScript(searchQuery.trim(), all)
      : all.map((a) => ({ ...a, highlights: [] as any[] }));

    const grouped: Record<string, any[]> = {};
    const noSceneKey = '__nosence__';

    for (const a of filtered) {
      const key = a.sceneNumber != null ? String(a.sceneNumber) : noSceneKey;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    }

    const result = Object.entries(grouped)
      .map(([key, items]) => ({
        sceneNumber: key === noSceneKey ? null : Number(key),
        sceneLabel: key === noSceneKey ? '未指定场次' : `第${key}场`,
        count: items.length,
        annotations: items,
      }))
      .sort((a, b) => {
        if (a.sceneNumber == null) return 1;
        if (b.sceneNumber == null) return -1;
        return a.sceneNumber - b.sceneNumber;
      });

    return {
      groups: result,
      totalCount: filtered.length,
      sceneCount: result.length,
    };
  }

  async findOne(id: number, userId: number) {
    const annotation = await this.repo.findOne({ where: { id } });
    if (!annotation) return null;
    if (annotation.dramaId) {
      await this.dramasService.checkAccess(annotation.dramaId, userId, ['viewer']);
    }
    return annotation;
  }

  async getVersions(annotationId: number, userId: number) {
    const annotation = await this.repo.findOne({ where: { id: annotationId } });
    if (!annotation) return [];
    if (annotation.dramaId) {
      await this.dramasService.checkAccess(annotation.dramaId, userId, ['viewer']);
    }
    return this.versionRepo.find({
      where: { annotationId },
      order: { createdAt: 'DESC' },
    });
  }

  async getVersion(versionId: number, userId: number) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) return null;
    if (version.dramaId) {
      await this.dramasService.checkAccess(version.dramaId, userId, ['viewer']);
    }
    return version;
  }

  async update(id: number, data: Partial<Annotation>, userId: number, userRole: UserRole, username: string) {
    const annotation = await this.repo.findOne({ where: { id } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }
    if (annotation.dramaId) {
      await this.dramasService.checkAccess(annotation.dramaId, userId, ['viewer', 'actor', 'crew']);
    }
    if (!this.canModify(annotation, userId, userRole)) {
      throw new ForbiddenException('无权修改此批注');
    }

    let materialIds = annotation.materialIds ?? [];
    if (data.materialIds !== undefined) {
      materialIds = await this.validateMaterialIds(data.materialIds, annotation.dramaId);
    }

    await this.createVersion(annotation, VersionAction.UPDATE, userId);
    await this.repo.update(id, { ...data, materialIds });

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ANNOTATION,
      module: AuditModule.ANNOTATION,
      operatorId: userId,
      operatorName: username,
      targetId: id,
      targetType: 'annotation',
      detail: `更新批注 #${id}`,
      metadata: { dramaId: annotation.dramaId, data },
    });

    if (data.note && annotation.createdBy && annotation.createdBy !== userId) {
      const replier = await this.userRepo.findOne({ where: { id: userId } });
      const replierName = replier?.displayName || replier?.username || `用户#${userId}`;
      this.notificationsService.notifyAnnotationReply(
        id,
        data.note,
        userId,
        replierName,
      ).catch(() => {});
    }

    const contentPreview = annotation.scriptContent.length > 50
      ? annotation.scriptContent.substring(0, 50) + '...'
      : annotation.scriptContent;

    const targetUserIds = annotation.createdBy && annotation.createdBy !== userId ? [annotation.createdBy] : [];
    if (targetUserIds.length > 0) {
      this.notificationsService.notifyAnnotationUpdate(
        id,
        'updated',
        targetUserIds,
        userId,
        username,
      ).catch(() => {});
    }

    this.subscriptionsService.notifySubscribers(
      SubscriptionTargetType.ANNOTATION,
      id,
      'updated',
      '批注更新通知',
      `${username}更新了批注\n内容：${contentPreview}`,
      { old: annotation, new: data, dramaId: annotation.dramaId },
      userId,
    ).catch(() => {});

    return this.repo.findOne({ where: { id } });
  }

  async restoreToVersion(annotationId: number, versionId: number, userId: number, userRole: UserRole, username: string) {
    const annotation = await this.repo.findOne({ where: { id: annotationId } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }
    if (annotation.dramaId) {
      await this.dramasService.checkAccess(annotation.dramaId, userId, ['viewer', 'actor', 'crew']);
    }
    if (!this.canModify(annotation, userId, userRole)) {
      throw new ForbiddenException('无权恢复此批注');
    }

    const version = await this.versionRepo.findOne({ where: { id: versionId, annotationId } });
    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    await this.createVersion(annotation, VersionAction.RESTORE, userId);

    await this.repo.update(annotationId, {
      scriptContent: version.scriptContent,
      note: version.note,
      startOffset: version.startOffset,
      endOffset: version.endOffset,
      tag: version.tag,
      tagColor: version.tagColor,
      sceneNumber: version.sceneNumber,
    });

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ANNOTATION,
      module: AuditModule.ANNOTATION,
      operatorId: userId,
      operatorName: username,
      targetId: annotationId,
      targetType: 'annotation',
      detail: `恢复批注 #${annotationId} 到版本 #${versionId}`,
      metadata: { dramaId: annotation.dramaId, versionId },
    });

    return this.repo.findOne({ where: { id: annotationId } });
  }

  async remove(id: number, userId: number, userRole: UserRole, username: string) {
    const annotation = await this.repo.findOne({ where: { id } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }
    if (annotation.dramaId) {
      await this.dramasService.checkAccess(annotation.dramaId, userId, ['owner', 'director']);
    }
    if (!this.canModify(annotation, userId, userRole)) {
      throw new ForbiddenException('无权删除此批注');
    }

    await this.createVersion(annotation, VersionAction.DELETE, userId);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_ANNOTATION,
      module: AuditModule.ANNOTATION,
      operatorId: userId,
      operatorName: username,
      targetId: id,
      targetType: 'annotation',
      detail: `删除批注 #${id}`,
      metadata: { dramaId: annotation.dramaId, tag: annotation.tag, sceneNumber: annotation.sceneNumber },
    });

    const targetUserIds = annotation.createdBy && annotation.createdBy !== userId ? [annotation.createdBy] : [];
    if (targetUserIds.length > 0) {
      this.notificationsService.notifyAnnotationUpdate(
        id,
        'deleted',
        targetUserIds,
        userId,
        username,
      ).catch(() => {});
    }

    this.subscriptionsService.notifySubscribers(
      SubscriptionTargetType.ANNOTATION,
      id,
      'deleted',
      '批注删除通知',
      `批注已被删除`,
      { annotation, dramaId: annotation.dramaId },
      userId,
    ).catch(() => {});

    return this.repo.delete(id);
  }

  async getAllTags(dramaId: number | undefined, userId: number) {
    let annotations: Annotation[];
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
      annotations = await this.repo.find({ where: { dramaId }, select: ['tag', 'tagColor'] });
    } else {
      const dramaIds = await this.dramasService.getUserDramaIds(userId);
      if (dramaIds.length === 0) {
        annotations = [];
      } else {
        annotations = await this.repo.find({ where: { dramaId: In(dramaIds) }, select: ['tag', 'tagColor'] });
      }
    }
    const tagMap = new Map<string, string | null>();
    annotations.forEach((a) => {
      if (a.tag && !tagMap.has(a.tag)) {
        tagMap.set(a.tag, a.tagColor || null);
      }
    });
    return Array.from(tagMap.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  async getStatsByDrama(dramaId: number): Promise<number> {
    return this.repo.count({ where: { dramaId } });
  }

  searchInScript(query: string, annotations: Annotation[]) {
    const lowerQuery = query.toLowerCase();
    return annotations
      .filter((a) => a.scriptContent.toLowerCase().includes(lowerQuery) || a.note?.toLowerCase().includes(lowerQuery))
      .map((a) => {
        const highlights: { field: string; start: number; end: number }[] = [];

        const contentLower = a.scriptContent.toLowerCase();
        let idx = contentLower.indexOf(lowerQuery);
        while (idx !== -1) {
          highlights.push({ field: 'scriptContent', start: idx, end: idx + query.length });
          idx = contentLower.indexOf(lowerQuery, idx + 1);
        }

        if (a.note) {
          const noteLower = a.note.toLowerCase();
          let nidx = noteLower.indexOf(lowerQuery);
          while (nidx !== -1) {
            highlights.push({ field: 'note', start: nidx, end: nidx + query.length });
            nidx = noteLower.indexOf(lowerQuery, nidx + 1);
          }
        }

        return { ...a, highlights };
      });
  }
}
