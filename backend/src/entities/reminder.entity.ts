import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ReminderType, ReminderChannel } from './reminder-config.entity';

export enum ReminderStatus {
  PENDING = 'pending',
  SENT = 'sent',
  READ = 'read',
  DISMISSED = 'dismissed',
  FAILED = 'failed',
}

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'simple-enum', enum: ReminderType })
  type: ReminderType;

  @Column({ type: 'simple-enum', enum: ReminderChannel })
  channel: ReminderChannel;

  @Column({ type: 'simple-enum', enum: ReminderStatus, default: ReminderStatus.PENDING })
  status: ReminderStatus;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  rehearsalId: number;

  @Column({ nullable: true })
  materialId: number;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
