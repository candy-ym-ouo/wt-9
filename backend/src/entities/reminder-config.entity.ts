import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from './user.entity';

export enum ReminderType {
  REHEARSAL_TODAY = 'rehearsal_today',
  REHEARSAL_UPCOMING = 'rehearsal_upcoming',
  MATERIAL_DUE = 'material_due',
  TASK_ASSIGNED = 'task_assigned',
}

export enum ReminderChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

@Entity('reminder_configs')
export class ReminderConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: ReminderType })
  type: ReminderType;

  @Column({ type: 'simple-enum', enum: UserRole, array: true, default: [] })
  targetRoles: UserRole[];

  @Column({ type: 'simple-enum', enum: ReminderChannel, array: true, default: [ReminderChannel.IN_APP] })
  channels: ReminderChannel[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 60 })
  advanceMinutes: number;

  @Column({ type: 'text', nullable: true })
  template: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
