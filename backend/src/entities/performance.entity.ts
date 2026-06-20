import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PerformanceStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('performances')
export class Performance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime' })
  endTime: Date;

  @Column({ nullable: true })
  venue: string;

  @Column({ nullable: true })
  theater: string;

  @Column({ type: 'simple-enum', enum: PerformanceStatus, default: PerformanceStatus.DRAFT })
  status: PerformanceStatus;

  @Column({ type: 'simple-json', nullable: true })
  roleIds: number[];

  @Column({ type: 'simple-json', nullable: true })
  materialIds: number[];

  @Column({ type: 'simple-json', nullable: true })
  castAssignments: Record<number, {
    actorId?: number;
    substituteActorIds?: number[];
    notes?: string;
  }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'int', nullable: true })
  expectedAudience: number;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
