import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user.entity';

export enum AnnouncementCategory {
  GENERAL = 'general',
  REHEARSAL = 'rehearsal',
  PERFORMANCE = 'performance',
  ADMIN = 'admin',
  IMPORTANT = 'important',
}

export enum AnnouncementStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: AnnouncementCategory.GENERAL })
  category: AnnouncementCategory;

  @Column({ default: AnnouncementStatus.DRAFT })
  status: AnnouncementStatus;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  visibleRoles: UserRole[];

  @Column({ default: false })
  isPinned: boolean;

  @Column({ type: 'datetime', nullable: true })
  pinExpiresAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  attachmentIds: number[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  tags: string[];

  @Column({ type: 'integer', nullable: true, default: 0 })
  viewCount: number;

  @Column({ nullable: true })
  createdBy: number;

  @Column({ nullable: true })
  updatedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
