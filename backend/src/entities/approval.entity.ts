import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ApprovalType {
  MATERIAL_OFFSHELF = 'material_offshelf',
  ROLE_ADJUSTMENT = 'role_adjustment',
  PERFORMANCE_CHANGE = 'performance_change',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum ApprovalStepStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: ApprovalType })
  type: ApprovalType;

  @Column({ type: 'simple-enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  dramaId: number;

  @Column({ nullable: true })
  targetId: number;

  @Column()
  targetType: string;

  @Column({ type: 'text', nullable: true })
  targetData: string;

  @Column({ type: 'int' })
  requesterId: number;

  @Column({ nullable: true })
  requesterName: string;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  approverIds: number[];

  @Column({ type: 'int', default: 0 })
  currentStepIndex: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  steps: Array<{
    index: number;
    approverId: number;
    approverName?: string;
    status: ApprovalStepStatus;
    comment?: string;
    decidedAt?: Date;
  }>;

  @Column({ nullable: true })
  finalApproverId: number;

  @Column({ nullable: true })
  finalApproverName: string;

  @Column({ type: 'text', nullable: true })
  finalComment: string;

  @Column({ type: 'datetime', nullable: true })
  decidedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
