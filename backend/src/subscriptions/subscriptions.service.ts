import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Subscription,
  SubscriptionTargetType,
  SubscriptionType,
  User,
  Rehearsal,
  CastRole,
  Annotation,
  Material,
  Notification,
  NotificationType,
  NotificationPriority,
  AuditAction,
  AuditModule,
} from '../entities';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';

export interface CreateSubscriptionDto {
  targetType: SubscriptionTargetType;
  targetId: number;
  dramaId?: number;
  subscriptionType?: SubscriptionType;
  notifyOnUpdate?: boolean;
  notifyOnDelete?: boolean;
  metadata?: Record<string, any>;
}

export interface SubscriptionsQueryOptions {
  targetType?: SubscriptionTargetType;
  subscriptionType?: SubscriptionType;
  dramaId?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    private notificationsService: NotificationsService,
    private auditLogsService: AuditLogsService,
    private dramasService: DramasService,
  ) {}

  async create(dto: CreateSubscriptionDto, userId: number, username: string): Promise<Subscription> {
    if (!dto.targetType || !dto.targetId) {
      throw new BadRequestException('缺少必填字段: targetType, targetId');
    }

    if (dto.dramaId) {
      await this.dramasService.checkAccess(dto.dramaId, userId, ['viewer']);
    }

    const existing = await this.subscriptionRepo.findOne({
      where: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
    });

    if (existing) {
      if (dto.subscriptionType) {
        existing.subscriptionType = dto.subscriptionType;
      }
      if (dto.notifyOnUpdate !== undefined) {
        existing.notifyOnUpdate = dto.notifyOnUpdate;
      }
      if (dto.notifyOnDelete !== undefined) {
        existing.notifyOnDelete = dto.notifyOnDelete;
      }
      if (dto.metadata) {
        existing.metadata = { ...existing.metadata, ...dto.metadata };
      }
      const updated = await this.subscriptionRepo.save(existing);

      const targetLabel = this.getTargetLabel(dto.targetType, dto.targetId);
      await this.auditLogsService.log({
        action: AuditAction.UPDATE_SUBSCRIPTION,
        module: AuditModule.SUBSCRIPTION,
        operatorId: userId,
        operatorName: username,
        targetId: updated.id,
        targetType: 'subscription',
        detail: `更新${this.getTargetTypeLabel(dto.targetType)}「${targetLabel}」的订阅/收藏`,
        metadata: { ...dto, subscriptionId: updated.id },
      });

      return this.enrichWithTargetInfo(updated);
    }

    const subscription = this.subscriptionRepo.create({
      ...dto,
      userId,
      subscriptionType: dto.subscriptionType || SubscriptionType.SUBSCRIBE,
      notifyOnUpdate: dto.notifyOnUpdate !== undefined ? dto.notifyOnUpdate : true,
      notifyOnDelete: dto.notifyOnDelete !== undefined ? dto.notifyOnDelete : true,
    });

    const saved = await this.subscriptionRepo.save(subscription);

    const targetLabel = await this.getTargetLabel(dto.targetType, dto.targetId);
    await this.auditLogsService.log({
      action: AuditAction.CREATE_SUBSCRIPTION,
      module: AuditModule.SUBSCRIPTION,
      operatorId: userId,
      operatorName: username,
      targetId: saved.id,
      targetType: 'subscription',
      detail: `${this.getSubscriptionTypeLabel(dto.subscriptionType || SubscriptionType.SUBSCRIBE)}${this.getTargetTypeLabel(dto.targetType)}「${targetLabel}」`,
      metadata: { ...dto, subscriptionId: saved.id },
    });

    return this.enrichWithTargetInfo(saved);
  }

  async remove(
    id: number,
    userId: number,
    username: string,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('订阅/收藏不存在');
    }

    if (subscription.userId !== userId) {
      throw new ForbiddenException('无权操作此订阅/收藏');
    }

    const targetLabel = await this.getTargetLabel(subscription.targetType, subscription.targetId);
    await this.auditLogsService.log({
      action: AuditAction.DELETE_SUBSCRIPTION,
      module: AuditModule.SUBSCRIPTION,
      operatorId: userId,
      operatorName: username,
      targetId: id,
      targetType: 'subscription',
      detail: `取消${this.getSubscriptionTypeLabel(subscription.subscriptionType)}${this.getTargetTypeLabel(subscription.targetType)}「${targetLabel}」`,
      metadata: {
        targetType: subscription.targetType,
        targetId: subscription.targetId,
        dramaId: subscription.dramaId,
      },
    });

    await this.subscriptionRepo.delete(id);
  }

  async removeByTarget(
    targetType: SubscriptionTargetType,
    targetId: number,
    userId: number,
    username: string,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, targetType, targetId },
    });
    if (!subscription) {
      return;
    }
    return this.remove(subscription.id, userId, username);
  }

  async findByUser(
    userId: number,
    options: SubscriptionsQueryOptions = {},
  ): Promise<{ items: any[]; total: number }> {
    const where: any = { userId };

    if (options.targetType) where.targetType = options.targetType;
    if (options.subscriptionType) where.subscriptionType = options.subscriptionType;
    if (options.dramaId) where.dramaId = options.dramaId;

    const [items, total] = await this.subscriptionRepo.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: options.offset || 0,
      take: options.limit || 50,
    });

    const enriched = await Promise.all(
      items.map((item) => this.enrichWithTargetInfo(item)),
    );

    return { items: enriched, total };
  }

  async findFavorites(
    userId: number,
    targetType?: SubscriptionTargetType,
  ): Promise<any[]> {
    const where: any = {
      userId,
    };
    if (targetType) {
      where.targetType = targetType;
    }

    const items = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .where('sub.userId = :userId', { userId })
      .andWhere('(sub.subscriptionType = :favorite OR sub.subscriptionType = :both)', {
        favorite: SubscriptionType.FAVORITE,
        both: SubscriptionType.BOTH,
      })
      .andWhere(targetType ? 'sub.targetType = :targetType' : '1=1', targetType ? { targetType } : {})
      .orderBy('sub.updatedAt', 'DESC')
      .getMany();

    return Promise.all(items.map((item) => this.enrichWithTargetInfo(item)));
  }

  async findSubscriptions(
    userId: number,
    targetType?: SubscriptionTargetType,
  ): Promise<any[]> {
    const where: any = { userId };
    if (targetType) where.targetType = targetType;

    const items = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .where('sub.userId = :userId', { userId })
      .andWhere('(sub.subscriptionType = :subscribe OR sub.subscriptionType = :both)', {
        subscribe: SubscriptionType.SUBSCRIBE,
        both: SubscriptionType.BOTH,
      })
      .andWhere(targetType ? 'sub.targetType = :targetType' : '1=1', targetType ? { targetType } : {})
      .orderBy('sub.updatedAt', 'DESC')
      .getMany();

    return Promise.all(items.map((item) => this.enrichWithTargetInfo(item)));
  }

  async findOne(id: number, userId: number): Promise<any> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('订阅/收藏不存在');
    }
    if (subscription.userId !== userId) {
      throw new ForbiddenException('无权访问此订阅/收藏');
    }
    return this.enrichWithTargetInfo(subscription);
  }

  async checkStatus(
    userId: number,
    targetType: SubscriptionTargetType,
    targetId: number,
  ): Promise<{
    isSubscribed: boolean;
    isFavorited: boolean;
    subscription: Subscription | null;
  }> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, targetType, targetId },
    });

    if (!subscription) {
      return { isSubscribed: false, isFavorited: false, subscription: null };
    }

    const isSubscribed =
      subscription.subscriptionType === SubscriptionType.SUBSCRIBE ||
      subscription.subscriptionType === SubscriptionType.BOTH;
    const isFavorited =
      subscription.subscriptionType === SubscriptionType.FAVORITE ||
      subscription.subscriptionType === SubscriptionType.BOTH;

    return { isSubscribed, isFavorited, subscription };
  }

  async getSubscribers(
    targetType: SubscriptionTargetType,
    targetId: number,
  ): Promise<Subscription[]> {
    return this.subscriptionRepo
      .createQueryBuilder('sub')
      .where('sub.targetType = :targetType', { targetType })
      .andWhere('sub.targetId = :targetId', { targetId })
      .andWhere('(sub.subscriptionType = :subscribe OR sub.subscriptionType = :both)', {
        subscribe: SubscriptionType.SUBSCRIBE,
        both: SubscriptionType.BOTH,
      })
      .getMany();
  }

  async getSubscriberUserIds(
    targetType: SubscriptionTargetType,
    targetId: number,
  ): Promise<number[]> {
    const subscribers = await this.getSubscribers(targetType, targetId);
    return subscribers.map((s) => s.userId);
  }

  async notifySubscribers(
    targetType: SubscriptionTargetType,
    targetId: number,
    action: 'created' | 'updated' | 'deleted',
    title: string,
    message: string,
    metadata?: Record<string, any>,
    senderId?: number,
  ): Promise<Notification[]> {
    const subscribers = await this.getSubscribers(targetType, targetId);

    const userIdsToNotify: number[] = [];
    for (const sub of subscribers) {
      if (action === 'deleted' && sub.notifyOnDelete) {
        userIdsToNotify.push(sub.userId);
      } else if ((action === 'created' || action === 'updated') && sub.notifyOnUpdate) {
        userIdsToNotify.push(sub.userId);
      }
    }

    if (userIdsToNotify.length === 0) {
      return [];
    }

    const notificationTypeMap: Record<SubscriptionTargetType, NotificationType> = {
      [SubscriptionTargetType.REHEARSAL]: NotificationType.REHEARSAL_CHANGE,
      [SubscriptionTargetType.ROLE]: NotificationType.ROLE_CHANGE,
      [SubscriptionTargetType.ANNOTATION]: NotificationType.ANNOTATION_UPDATE,
      [SubscriptionTargetType.MATERIAL]: NotificationType.MATERIAL_UPDATE,
    };

    const dto: any = {
      type: notificationTypeMap[targetType] || NotificationType.SUBSCRIPTION_UPDATE,
      title,
      message,
      priority: action === 'deleted' ? NotificationPriority.URGENT : NotificationPriority.HIGH,
      targetUserIds: userIdsToNotify,
      senderId,
      metadata: {
        targetType,
        targetId,
        action,
        ...metadata,
      },
    };

    if (targetType === SubscriptionTargetType.REHEARSAL) {
      dto.rehearsalId = targetId;
    } else if (targetType === SubscriptionTargetType.ROLE) {
      dto.roleId = targetId;
    } else if (targetType === SubscriptionTargetType.ANNOTATION) {
      dto.annotationId = targetId;
    } else if (targetType === SubscriptionTargetType.MATERIAL) {
      dto.materialId = targetId;
    }

    return this.notificationsService.create(dto);
  }

  async getUserStats(userId: number): Promise<{
    totalSubscriptions: number;
    totalFavorites: number;
    byType: Record<SubscriptionTargetType, { subscriptions: number; favorites: number }>;
  }> {
    const all = await this.subscriptionRepo.find({ where: { userId } });

    let totalSubscriptions = 0;
    let totalFavorites = 0;

    const byType: Record<string, { subscriptions: number; favorites: number }> = {};
    Object.values(SubscriptionTargetType).forEach((type) => {
      byType[type] = { subscriptions: 0, favorites: 0 };
    });

    for (const sub of all) {
      const isSub =
        sub.subscriptionType === SubscriptionType.SUBSCRIBE ||
        sub.subscriptionType === SubscriptionType.BOTH;
      const isFav =
        sub.subscriptionType === SubscriptionType.FAVORITE ||
        sub.subscriptionType === SubscriptionType.BOTH;

      if (isSub) {
        totalSubscriptions++;
        byType[sub.targetType].subscriptions++;
      }
      if (isFav) {
        totalFavorites++;
        byType[sub.targetType].favorites++;
      }
    }

    return {
      totalSubscriptions,
      totalFavorites,
      byType: byType as Record<SubscriptionTargetType, { subscriptions: number; favorites: number }>,
    };
  }

  private async enrichWithTargetInfo(subscription: Subscription): Promise<any> {
    const targetInfo = await this.getTargetInfo(subscription.targetType, subscription.targetId);
    return {
      ...subscription,
      targetInfo,
    };
  }

  private async getTargetInfo(
    targetType: SubscriptionTargetType,
    targetId: number,
  ): Promise<any> {
    try {
      switch (targetType) {
        case SubscriptionTargetType.REHEARSAL: {
          const rehearsal = await this.rehearsalRepo.findOne({ where: { id: targetId } });
          return rehearsal
            ? {
                id: rehearsal.id,
                title: rehearsal.title,
                startTime: rehearsal.startTime,
                endTime: rehearsal.endTime,
                location: rehearsal.location,
                dramaId: rehearsal.dramaId,
              }
            : null;
        }
        case SubscriptionTargetType.ROLE: {
          const role = await this.roleRepo.findOne({ where: { id: targetId } });
          return role
            ? {
                id: role.id,
                characterName: role.characterName,
                actorId: role.actorId,
                dramaId: role.dramaId,
              }
            : null;
        }
        case SubscriptionTargetType.ANNOTATION: {
          const annotation = await this.annotationRepo.findOne({ where: { id: targetId } });
          return annotation
            ? {
                id: annotation.id,
                scriptContent:
                  annotation.scriptContent.length > 100
                    ? annotation.scriptContent.substring(0, 100) + '...'
                    : annotation.scriptContent,
                note: annotation.note,
                scriptId: annotation.scriptId,
                dramaId: annotation.dramaId,
              }
            : null;
        }
        case SubscriptionTargetType.MATERIAL: {
          const material = await this.materialRepo.findOne({ where: { id: targetId } });
          return material
            ? {
                id: material.id,
                originalName: material.originalName,
                mimeType: material.mimeType,
                size: material.size,
                category: material.category,
                version: material.version,
                dramaId: material.dramaId,
              }
            : null;
        }
        default:
          return null;
      }
    } catch (e) {
      return null;
    }
  }

  private async getTargetLabel(
    targetType: SubscriptionTargetType,
    targetId: number,
  ): Promise<string> {
    const info = await this.getTargetInfo(targetType, targetId);
    if (!info) return `#${targetId}`;

    switch (targetType) {
      case SubscriptionTargetType.REHEARSAL:
        return info.title || `#${targetId}`;
      case SubscriptionTargetType.ROLE:
        return info.characterName || `#${targetId}`;
      case SubscriptionTargetType.ANNOTATION:
        return info.scriptContent || `#${targetId}`;
      case SubscriptionTargetType.MATERIAL:
        return info.originalName || `#${targetId}`;
      default:
        return `#${targetId}`;
    }
  }

  private getTargetTypeLabel(targetType: SubscriptionTargetType): string {
    const labels: Record<SubscriptionTargetType, string> = {
      [SubscriptionTargetType.REHEARSAL]: '排练',
      [SubscriptionTargetType.ROLE]: '角色',
      [SubscriptionTargetType.ANNOTATION]: '批注',
      [SubscriptionTargetType.MATERIAL]: '素材',
    };
    return labels[targetType] || targetType;
  }

  private getSubscriptionTypeLabel(type: SubscriptionType): string {
    const labels: Record<SubscriptionType, string> = {
      [SubscriptionType.SUBSCRIBE]: '订阅',
      [SubscriptionType.FAVORITE]: '收藏',
      [SubscriptionType.BOTH]: '订阅并收藏',
    };
    return labels[type] || type;
  }
}
