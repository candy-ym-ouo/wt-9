import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Drama } from './drama.entity';
import { User } from './user.entity';

export enum TemplateType {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export enum TemplateTargetScope {
  DRAMA = 'drama',
  TEAM = 'team',
}

export enum TemplateDramaRole {
  ADMIN = 'admin',
  DIRECTOR = 'director',
  ASSISTANT_DIRECTOR = 'assistant_director',
  ACTOR = 'actor',
  CREW = 'crew',
  VIEWER = 'viewer',
}

@Entity('permission_templates')
export class PermissionTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-enum', enum: TemplateType, default: TemplateType.CUSTOM })
  templateType: TemplateType;

  @Column({ type: 'simple-enum', enum: TemplateTargetScope, default: TemplateTargetScope.DRAMA })
  targetScope: TemplateTargetScope;

  @Column({ type: 'simple-enum', enum: TemplateDramaRole })
  dramaRole: TemplateDramaRole;

  @Column({ type: 'simple-json' })
  menus: string[];

  @Column({ type: 'simple-json' })
  operations: string[];

  @Column({ nullable: true })
  dramaId: number;

  @Column({ nullable: true })
  createdBy: number;

  @ManyToOne(() => Drama, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dramaId' })
  drama: Drama;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
