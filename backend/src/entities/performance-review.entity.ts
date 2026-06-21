import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PerformanceReviewType {
  ISSUE = 'issue',
  ACTOR_FEEDBACK = 'actor_feedback',
  MATERIAL_GAP = 'material_gap',
  IMPROVEMENT = 'improvement',
}

export enum PerformanceReviewStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum PerformanceReviewPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum PerformanceReviewSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

@Entity('performance_reviews')
export class PerformanceReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: PerformanceReviewType })
  type: PerformanceReviewType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-enum', enum: PerformanceReviewStatus, default: PerformanceReviewStatus.OPEN })
  status: PerformanceReviewStatus;

  @Column({ type: 'simple-enum', enum: PerformanceReviewPriority, default: PerformanceReviewPriority.MEDIUM })
  priority: PerformanceReviewPriority;

  @Column({ type: 'simple-enum', enum: PerformanceReviewSeverity, nullable: true })
  severity: PerformanceReviewSeverity;

  @Column({ nullable: true })
  performanceId: number;

  @Column({ nullable: true })
  dramaId: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  relatedRoleIds: number[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  relatedMaterialIds: number[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  relatedActorIds: number[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  relatedTaskIds: number[];

  @Column({ nullable: true })
  assigneeId: number;

  @Column({ nullable: true })
  reporterId: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  followerIds: number[];

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  comments: Array<{
    id: number;
    userId: number;
    content: string;
    createdAt: string;
  }>;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  statusHistory: Array<{
    id: number;
    fromStatus: PerformanceReviewStatus | null;
    toStatus: PerformanceReviewStatus;
    userId: number;
    remark?: string;
    createdAt: string;
  }>;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  category: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
