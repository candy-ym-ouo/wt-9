import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  FREEZE_USER = 'freeze_user',
  UNFREEZE_USER = 'unfreeze_user',
  UPDATE_ROLE = 'update_role',
  CREATE_USER = 'create_user',
  DELETE_USER = 'delete_user',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string;

  @Column()
  operatorId: number;

  @Column({ nullable: true })
  operatorName: string;

  @Column({ nullable: true })
  targetUserId: number;

  @Column({ nullable: true })
  targetUsername: string;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @CreateDateColumn()
  createdAt: Date;
}
