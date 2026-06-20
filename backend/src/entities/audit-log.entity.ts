import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  FREEZE_USER = 'freeze_user',
  UNFREEZE_USER = 'unfreeze_user',
  UPDATE_USER_ROLE = 'update_user_role',
  CREATE_USER = 'create_user',
  DELETE_USER = 'delete_user',
  UPDATE_ROLE = 'update_role',
  CREATE_ROLE = 'create_role',
  DELETE_ROLE = 'delete_role',
  ADD_ROLE_SUBSTITUTE = 'add_role_substitute',
  REMOVE_ROLE_SUBSTITUTE = 'remove_role_substitute',
  UPDATE_ROLE_PRIORITY = 'update_role_priority',
  CREATE_MATERIAL = 'create_material',
  UPDATE_MATERIAL = 'update_material',
  DELETE_MATERIAL = 'delete_material',
  CREATE_REHEARSAL = 'create_rehearsal',
  UPDATE_REHEARSAL = 'update_rehearsal',
  DELETE_REHEARSAL = 'delete_rehearsal',
  UPDATE_ATTENDANCE = 'update_attendance',
  CREATE_PERFORMANCE = 'create_performance',
  UPDATE_PERFORMANCE = 'update_performance',
  DELETE_PERFORMANCE = 'delete_performance',
  UPDATE_PERFORMANCE_STATUS = 'update_performance_status',
  BIND_PERFORMANCE_ROLE = 'bind_performance_role',
  UNBIND_PERFORMANCE_ROLE = 'unbind_performance_role',
  BIND_PERFORMANCE_MATERIAL = 'bind_performance_material',
  UNBIND_PERFORMANCE_MATERIAL = 'unbind_performance_material',
}

export enum AuditModule {
  USER = 'user',
  ROLE = 'role',
  MATERIAL = 'material',
  REHEARSAL = 'rehearsal',
  PERFORMANCE = 'performance',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string;

  @Column({ nullable: true })
  module: string;

  @Column()
  operatorId: number;

  @Column({ nullable: true })
  operatorName: string;

  @Column({ nullable: true })
  targetUserId: number;

  @Column({ nullable: true })
  targetUsername: string;

  @Column({ nullable: true })
  targetId: number;

  @Column({ nullable: true })
  targetType: string;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;
}
