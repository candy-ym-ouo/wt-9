import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ScriptVersionAction {
  CREATE = 'create',
  UPDATE = 'update',
  UPLOAD = 'upload',
  RESTORE = 'restore',
  PUBLISH = 'publish',
  ARCHIVE = 'archive',
}

@Entity('script_versions')
export class ScriptVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scriptId: number;

  @Column()
  versionNumber: number;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  changeNote: string;

  @Column({ type: 'text', nullable: true })
  rawContent: string;

  @Column({ type: 'text', nullable: true })
  parsedContent: string;

  @Column({ type: 'simple-json', nullable: true })
  chaptersSnapshot: any;

  @Column({ type: 'simple-json', nullable: true })
  scenesSnapshot: any;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any;

  @Column({ type: 'simple-enum', enum: ScriptVersionAction })
  action: ScriptVersionAction;

  @Column({ nullable: true })
  actionBy: number;

  @Column({ type: 'text', nullable: true })
  actionByName: string;

  @CreateDateColumn()
  createdAt: Date;
}
