import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum LeaveType {
  SICK = 'sick',
  PERSONAL = 'personal',
  OTHER = 'other',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actorId: number;

  @Column({ type: 'simple-enum', enum: LeaveType, default: LeaveType.OTHER })
  type: LeaveType;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'datetime' })
  startDate: Date;

  @Column({ type: 'datetime' })
  endDate: Date;

  @Column({ type: 'simple-enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ nullable: true })
  roleId: number;

  @Column({ nullable: true })
  substituteActorId: number;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  reviewedBy: number;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
