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
  UPLOAD_SCRIPT = 'upload_script',
  CREATE_SCRIPT = 'create_script',
  UPDATE_SCRIPT = 'update_script',
  DELETE_SCRIPT = 'delete_script',
  PUBLISH_SCRIPT = 'publish_script',
  ARCHIVE_SCRIPT = 'archive_script',
  RESTORE_SCRIPT_VERSION = 'restore_script_version',
  UPDATE_SCRIPT_CHAPTER = 'update_script_chapter',
  UPDATE_SCRIPT_SCENE = 'update_script_scene',
  REPARSE_SCRIPT = 'reparse_script',
  CREATE_ACTOR_PROFILE = 'create_actor_profile',
  UPDATE_ACTOR_PROFILE = 'update_actor_profile',
  DELETE_ACTOR_PROFILE = 'delete_actor_profile',
  UPDATE_ACTOR_AVAILABILITY = 'update_actor_availability',
  CREATE_HISTORICAL_ROLE = 'create_historical_role',
  UPDATE_HISTORICAL_ROLE = 'update_historical_role',
  DELETE_HISTORICAL_ROLE = 'delete_historical_role',
  BIND_ACTOR_MATERIAL = 'bind_actor_material',
  UNBIND_ACTOR_MATERIAL = 'unbind_actor_material',
  CREATE_TASK = 'create_task',
  UPDATE_TASK = 'update_task',
  DELETE_TASK = 'delete_task',
  ASSIGN_TASK = 'assign_task',
  UPDATE_TASK_STATUS = 'update_task_status',
  ADD_TASK_COMMENT = 'add_task_comment',
  ADD_TASK_FOLLOWER = 'add_task_follower',
  REMOVE_TASK_FOLLOWER = 'remove_task_follower',
  CREATE_EXPENSE_CATEGORY = 'create_expense_category',
  UPDATE_EXPENSE_CATEGORY = 'update_expense_category',
  DELETE_EXPENSE_CATEGORY = 'delete_expense_category',
  CREATE_REIMBURSEMENT = 'create_reimbursement',
  UPDATE_REIMBURSEMENT = 'update_reimbursement',
  DELETE_REIMBURSEMENT = 'delete_reimbursement',
  APPROVE_REIMBURSEMENT = 'approve_reimbursement',
  REJECT_REIMBURSEMENT = 'reject_reimbursement',
  PAY_REIMBURSEMENT = 'pay_reimbursement',
  CREATE_MATERIAL_PURCHASE = 'create_material_purchase',
  UPDATE_MATERIAL_PURCHASE = 'update_material_purchase',
  DELETE_MATERIAL_PURCHASE = 'delete_material_purchase',
  APPROVE_MATERIAL_PURCHASE = 'approve_material_purchase',
  REJECT_MATERIAL_PURCHASE = 'reject_material_purchase',
  ORDER_MATERIAL_PURCHASE = 'order_material_purchase',
  RECEIVE_MATERIAL_PURCHASE = 'receive_material_purchase',
  CREATE_REHEARSAL_ROOM = 'create_rehearsal_room',
  UPDATE_REHEARSAL_ROOM = 'update_rehearsal_room',
  DELETE_REHEARSAL_ROOM = 'delete_rehearsal_room',
  CREATE_EQUIPMENT = 'create_equipment',
  UPDATE_EQUIPMENT = 'update_equipment',
  DELETE_EQUIPMENT = 'delete_equipment',
  CREATE_ROOM_RESERVATION = 'create_room_reservation',
  UPDATE_ROOM_RESERVATION = 'update_room_reservation',
  DELETE_ROOM_RESERVATION = 'delete_room_reservation',
  APPROVE_ROOM_RESERVATION = 'approve_room_reservation',
  REJECT_ROOM_RESERVATION = 'reject_room_reservation',
  CANCEL_ROOM_RESERVATION = 'cancel_room_reservation',
  CREATE_LEAVE = 'create_leave',
  UPDATE_LEAVE = 'update_leave',
  DELETE_LEAVE = 'delete_leave',
  APPROVE_LEAVE = 'approve_leave',
  REJECT_LEAVE = 'reject_leave',
  UPDATE_LEAVE_SUBSTITUTE = 'update_leave_substitute',
  CREATE_ANNOUNCEMENT = 'create_announcement',
  UPDATE_ANNOUNCEMENT = 'update_announcement',
  DELETE_ANNOUNCEMENT = 'delete_announcement',
  PUBLISH_ANNOUNCEMENT = 'publish_announcement',
  ARCHIVE_ANNOUNCEMENT = 'archive_announcement',
  PIN_ANNOUNCEMENT = 'pin_announcement',
  UNPIN_ANNOUNCEMENT = 'unpin_announcement',
  CREATE_DRAMA = 'create_drama',
  UPDATE_DRAMA = 'update_drama',
  DELETE_DRAMA = 'delete_drama',
  GRANT_DRAMA_PERMISSION = 'grant_drama_permission',
  REVOKE_DRAMA_PERMISSION = 'revoke_drama_permission',
  UPDATE_DRAMA_PERMISSION = 'update_drama_permission',
  CREATE_ANNOTATION = 'create_annotation',
  UPDATE_ANNOTATION = 'update_annotation',
  DELETE_ANNOTATION = 'delete_annotation',
}

export enum AuditModule {
  USER = 'user',
  ROLE = 'role',
  MATERIAL = 'material',
  REHEARSAL = 'rehearsal',
  PERFORMANCE = 'performance',
  SCRIPT = 'script',
  ACTOR_PROFILE = 'actor_profile',
  TASK = 'task',
  BUDGET = 'budget',
  EXPENSE_CATEGORY = 'expense_category',
  REIMBURSEMENT = 'reimbursement',
  MATERIAL_PURCHASE = 'material_purchase',
  REHEARSAL_ROOM = 'rehearsal_room',
  EQUIPMENT = 'equipment',
  ROOM_RESERVATION = 'room_reservation',
  LEAVE = 'leave',
  ANNOUNCEMENT = 'announcement',
  DRAMA = 'drama',
  ANNOTATION = 'annotation',
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
