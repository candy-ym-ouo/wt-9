import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum HistoricalRoleStatus {
  COMPLETED = 'completed',
  IN_PROGRESS = 'in_progress',
  CANCELLED = 'cancelled',
}

@Entity('historical_roles')
export class HistoricalRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actorProfileId: number;

  @Column()
  productionName: string;

  @Column()
  characterName: string;

  @Column({ nullable: true })
  characterType: string;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ nullable: true })
  venue: string;

  @Column({ nullable: true })
  director: string;

  @Column({ type: 'simple-enum', enum: HistoricalRoleStatus, default: HistoricalRoleStatus.COMPLETED })
  status: HistoricalRoleStatus;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  materialIds: number[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  review: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  performanceCount: number | null;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
