import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from './user.entity';

export enum NotificationType {
  REHEARSAL_CHANGE = 'rehearsal_change',
  MATERIAL_UPDATE = 'material_update',
  ANNOTATION_REPLY = 'annotation_reply',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'simple-enum', enum: NotificationPriority, default: NotificationPriority.MEDIUM })
  priority: NotificationPriority;

  @Column({ type: 'simple-enum', enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'simple-enum', enum: UserRole, array: true, nullable: true })
  targetRoles: UserRole[];

  @Column({ type: 'simple-json', nullable: true })
  targetUserIds: number[];

  @Column({ nullable: true })
  rehearsalId: number;

  @Column({ nullable: true })
  materialId: number;

  @Column({ nullable: true })
  annotationId: number;

  @Column({ nullable: true })
  senderId: number;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
