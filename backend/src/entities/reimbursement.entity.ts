import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ReimbursementStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

@Entity('reimbursements')
export class Reimbursement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  categoryId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];

  @Column({ nullable: true })
  performanceId: number;

  @Column({ nullable: true })
  applicantId: number;

  @Column({ type: 'simple-enum', enum: ReimbursementStatus, default: ReimbursementStatus.PENDING })
  status: ReimbursementStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  reviewedBy: number;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  paidBy: number;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
