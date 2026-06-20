import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TaskCategory {
  PREPARATION = 'preparation',
  MATERIAL_FILL = 'material_fill',
  ROLE_CONFIRMATION = 'role_confirmation',
  OTHER = 'other',
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: TaskCategory.OTHER })
  category: TaskCategory;

  @Column({ default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column({ nullable: true })
  rehearsalId: number;

  @Column({ nullable: true })
  roleId: number;

  @Column({ nullable: true })
  materialId: number;

  @Column({ nullable: true })
  performanceId: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  relatedMaterialIds: number[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  relatedRoleIds: number[];

  @Column({ nullable: true })
  assigneeId: number;

  @Column({ nullable: true })
  assignerId: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  followerIds: number[];

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

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
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus;
    userId: number;
    remark?: string;
    createdAt: string;
  }>;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  tags: string[];

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
