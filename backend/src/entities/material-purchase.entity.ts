import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PurchaseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ORDERED = 'ordered',
  RECEIVED = 'received',
}

@Entity('material_purchases')
export class MaterialPurchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  itemName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  categoryId: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ nullable: true })
  supplier: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];

  @Column({ nullable: true })
  performanceId: number;

  @Column({ nullable: true })
  requesterId: number;

  @Column({ type: 'simple-enum', enum: PurchaseStatus, default: PurchaseStatus.PENDING })
  status: PurchaseStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  reviewedBy: number;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  receivedBy: number;

  @Column({ type: 'datetime', nullable: true })
  receivedAt: Date;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
