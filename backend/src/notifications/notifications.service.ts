import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  User,
  UserRole,
  Rehearsal,
  Material,
  Annotation,
} from '../entities';

export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  targetRoles?: UserRole[];
  targetUserIds?: number[];
  rehearsalId?: number;
  materialId?: number;
  annotationId?: number;
  senderId?: number;
  expiresAt?: Date;
}

export interface NotificationQueryOptions {
  type?: NotificationType;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification[]> {
    if (!dto.title || !dto.message || !dto.type) {
      throw new BadRequestException('缺少必填字段: title, message, type');
    }

    const targetUserIds = await this.resolveTargetUsers(dto.targetRoles, dto.targetUserIds);

    if (targetUserIds.length === 0) {
      throw new BadRequestException('没有有效的目标用户');
    }

    const notifications: Notification[] = [];

    for (const userId of targetUserIds) {
      const notification = this.notificationRepo.create({
        type: dto.type,
        title: dto.title,
        message: dto.message,
        priority: dto.priority || NotificationPriority.MEDIUM,
        status: NotificationStatus.UNREAD,
        metadata: dto.metadata,
        targetRoles: dto.targetRoles,
        targetUserIds: [userId],
        rehearsalId: dto.rehearsalId,
        materialId: dto.materialId,
        annotationId: dto.annotationId,
        senderId: dto.senderId,
        expiresAt: dto.expiresAt,
      });

      notifications.push(await this.notificationRepo.save(notification));
    }

    return notifications;
  }

  private async resolveTargetUsers(
    targetRoles?: UserRole[],
    targetUserIds?: number[],
  ): Promise<number[]> {
    const userIds = new Set<number>();

    if (targetUserIds && targetUserIds.length > 0) {
      const validUsers = await this.userRepo.findByIds(targetUserIds);
      validUsers.forEach((u) => userIds.add(u.id));
    }

    if (targetRoles && targetRoles.length > 0) {
      const roleUsers = await this.userRepo.find({
        where: { role: In(targetRoles) },
      });
      roleUsers.forEach((u) => userIds.add(u.id));
    }

    return Array.from(userIds);
  }

  async getUserNotifications(
    userId: number,
    userRole: UserRole,
    options: NotificationQueryOptions = {},
  ): Promise<{ items: Notification[]; total: number }> {
    const where: any = {};

    if (options.type) where.type = options.type;
    if (options.priority) where.priority = options.priority;

    if (options.status) {
      where.status = options.status;
    } else if (!options.includeArchived) {
      where.status = Not(NotificationStatus.ARCHIVED);
    }

    const allItems = await this.notificationRepo.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });

    const filtered = allItems.filter((n) => n.targetUserIds?.includes(userId));

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const items = filtered.slice(offset, offset + limit);
    const total = filtered.length;

    return { items, total };
  }

  async getUnreadCount(userId: number): Promise<number> {
    const allUnread = await this.notificationRepo.find({
      where: {
        status: NotificationStatus.UNREAD,
      },
    });

    return allUnread.filter((n) => n.targetUserIds?.includes(userId)).length;
  }

  async getSummary(userId: number, userRole: UserRole): Promise<NotificationSummary> {
    const { items } = await this.getUserNotifications(userId, userRole, { limit: 1000 });

    const unread = items.filter((n) => n.status === NotificationStatus.UNREAD).length;

    const byType = {} as Record<NotificationType, number>;
    const byPriority = {} as Record<NotificationPriority, number>;

    Object.values(NotificationType).forEach((type) => {
      byType[type] = 0;
    });
    Object.values(NotificationPriority).forEach((priority) => {
      byPriority[priority] = 0;
    });

    items.forEach((n) => {
      byType[n.type]++;
      byPriority[n.priority]++;
    });

    return {
      total: items.length,
      unread,
      byType,
      byPriority,
    };
  }

  async findOne(notificationId: number, userId: number): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (!notification.targetUserIds?.includes(userId)) {
      throw new ForbiddenException('无权访问此通知');
    }

    return notification;
  }

  async markAsRead(notificationId: number, userId: number): Promise<Notification> {
    const notification = await this.findOne(notificationId, userId);

    if (notification.status !== NotificationStatus.READ) {
      notification.status = NotificationStatus.READ;
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }

    return notification;
  }

  async markAllAsRead(userId: number): Promise<number> {
    const allUnread = await this.notificationRepo.find({
      where: { status: NotificationStatus.UNREAD },
    });

    const toUpdate = allUnread.filter((n) => n.targetUserIds?.includes(userId));
    const now = new Date();

    for (const notification of toUpdate) {
      notification.status = NotificationStatus.READ;
      notification.readAt = now;
      await this.notificationRepo.save(notification);
    }

    return toUpdate.length;
  }

  async markAsUnread(notificationId: number, userId: number): Promise<Notification> {
    const notification = await this.findOne(notificationId, userId);

    if (notification.status !== NotificationStatus.UNREAD) {
      notification.status = NotificationStatus.UNREAD;
      notification.readAt = null;
      await this.notificationRepo.save(notification);
    }

    return notification;
  }

  async archive(notificationId: number, userId: number): Promise<Notification> {
    const notification = await this.findOne(notificationId, userId);

    if (notification.status !== NotificationStatus.ARCHIVED) {
      notification.status = NotificationStatus.ARCHIVED;
      await this.notificationRepo.save(notification);
    }

    return notification;
  }

  async unarchive(notificationId: number, userId: number): Promise<Notification> {
    const notification = await this.findOne(notificationId, userId);

    if (notification.status === NotificationStatus.ARCHIVED) {
      notification.status = NotificationStatus.READ;
      await this.notificationRepo.save(notification);
    }

    return notification;
  }

  async remove(notificationId: number, userId: number, userRole: UserRole): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (userRole !== UserRole.ADMIN && userRole !== UserRole.DIRECTOR) {
      if (!notification.targetUserIds?.includes(userId)) {
        throw new ForbiddenException('无权删除此通知');
      }
    }

    await this.notificationRepo.delete(notificationId);
  }

  async deleteAllForUser(userId: number): Promise<number> {
    const all = await this.notificationRepo.find();
    const toDelete = all.filter((n) => n.targetUserIds?.includes(userId));

    for (const notification of toDelete) {
      await this.notificationRepo.delete(notification.id);
    }

    return toDelete.length;
  }

  async notifyRehearsalChange(
    rehearsalId: number,
    action: 'created' | 'updated' | 'deleted',
    changes?: string[],
    senderId?: number,
  ): Promise<Notification[]> {
    const rehearsal = await this.rehearsalRepo.findOne({ where: { id: rehearsalId } });
    if (!rehearsal && action !== 'deleted') {
      throw new NotFoundException('排练不存在');
    }

    const participantIds = rehearsal?.participantIds || [];

    let title = '';
    let message = '';
    let priority = NotificationPriority.MEDIUM;

    const timeStr = rehearsal
      ? `${new Date(rehearsal.startTime).toLocaleString('zh-CN')} ~ ${new Date(rehearsal.endTime).toLocaleString('zh-CN')}`
      : '';

    switch (action) {
      case 'created':
        title = '新排练通知';
        message = `排练「${rehearsal!.title}」已创建\n时间：${timeStr}\n地点：${rehearsal!.location || '待定'}`;
        priority = NotificationPriority.HIGH;
        break;
      case 'updated':
        title = '排练变更通知';
        const changeDetails = changes && changes.length > 0 ? `\n变更内容：${changes.join('；')}` : '';
        message = `排练「${rehearsal!.title}」已更新\n时间：${timeStr}\n地点：${rehearsal!.location || '待定'}${changeDetails}`;
        priority = NotificationPriority.HIGH;
        break;
      case 'deleted':
        title = '排练取消通知';
        message = `排练已被取消`;
        priority = NotificationPriority.URGENT;
        break;
    }

    return this.create({
      type: NotificationType.REHEARSAL_CHANGE,
      title,
      message,
      priority,
      targetUserIds: participantIds,
      targetRoles: action === 'created' || action === 'updated'
        ? [UserRole.ADMIN, UserRole.DIRECTOR]
        : undefined,
      rehearsalId,
      senderId,
      metadata: { action, changes, rehearsal },
    });
  }

  async notifyMaterialUpdate(
    materialId: number,
    action: 'created' | 'updated' | 'deleted' | 'new_version',
    senderId?: number,
  ): Promise<Notification[]> {
    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material && action !== 'deleted') {
      throw new NotFoundException('素材不存在');
    }

    let title = '';
    let message = '';
    let priority = NotificationPriority.MEDIUM;

    switch (action) {
      case 'created':
        title = '新素材上传';
        message = `新素材「${material!.originalName}」已上传\n类型：${material!.mimeType}\n大小：${this.formatFileSize(material!.size)}`;
        break;
      case 'updated':
        title = '素材更新通知';
        message = `素材「${material!.originalName}」已更新`;
        break;
      case 'new_version':
        title = '素材新版本';
        message = `素材「${material!.originalName}」已更新到 v${material!.version}`;
        priority = NotificationPriority.HIGH;
        break;
      case 'deleted':
        title = '素材删除通知';
        message = `素材已被删除`;
        break;
    }

    return this.create({
      type: NotificationType.MATERIAL_UPDATE,
      title,
      message,
      priority,
      targetRoles: [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.ACTOR],
      materialId,
      senderId,
      metadata: { action, material },
    });
  }

  async notifyAnnotationReply(
    annotationId: number,
    replyContent: string,
    replierId: number,
    replierName: string,
  ): Promise<Notification[]> {
    const annotation = await this.annotationRepo.findOne({ where: { id: annotationId } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }

    const targetUserIds: number[] = [];
    if (annotation.createdBy && annotation.createdBy !== replierId) {
      targetUserIds.push(annotation.createdBy);
    }

    if (targetUserIds.length === 0) {
      return [];
    }

    const contentPreview = annotation.scriptContent.length > 50
      ? annotation.scriptContent.substring(0, 50) + '...'
      : annotation.scriptContent;

    return this.create({
      type: NotificationType.ANNOTATION_REPLY,
      title: '批注回复通知',
      message: `${replierName} 回复了您的批注\n原内容：${contentPreview}\n回复：${replyContent}`,
      priority: NotificationPriority.MEDIUM,
      targetUserIds,
      annotationId,
      senderId: replierId,
      metadata: { annotation, replyContent, replierId, replierName },
    });
  }

  async createSystemAnnouncement(
    title: string,
    message: string,
    targetRoles: UserRole[] = Object.values(UserRole),
    priority: NotificationPriority = NotificationPriority.HIGH,
    senderId?: number,
    expiresAt?: Date,
  ): Promise<Notification[]> {
    return this.create({
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      priority,
      targetRoles,
      senderId,
      expiresAt,
      metadata: { isSystem: true },
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async getNotificationTypes(): Promise<Array<{ value: NotificationType; label: string }>> {
    return [
      { value: NotificationType.REHEARSAL_CHANGE, label: '排练变更' },
      { value: NotificationType.MATERIAL_UPDATE, label: '素材更新' },
      { value: NotificationType.ANNOTATION_REPLY, label: '批注回复' },
      { value: NotificationType.SYSTEM_ANNOUNCEMENT, label: '系统公告' },
    ];
  }

  async getNotificationPriorities(): Promise<Array<{ value: NotificationPriority; label: string }>> {
    return [
      { value: NotificationPriority.LOW, label: '低' },
      { value: NotificationPriority.MEDIUM, label: '中' },
      { value: NotificationPriority.HIGH, label: '高' },
      { value: NotificationPriority.URGENT, label: '紧急' },
    ];
  }
}
