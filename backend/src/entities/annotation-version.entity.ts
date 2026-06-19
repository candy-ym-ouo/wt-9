import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Annotation } from './annotation.entity';

export enum VersionAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  RESTORE = 'restore',
}

@Entity('annotation_versions')
export class AnnotationVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  annotationId: number;

  @Column({ type: 'text', nullable: true })
  scriptContent: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ nullable: true })
  startOffset: number;

  @Column({ nullable: true })
  endOffset: number;

  @Column({ nullable: true })
  tag: string;

  @Column({ nullable: true })
  tagColor: string;

  @Column({ nullable: true })
  sceneNumber: number;

  @Column({ nullable: true })
  createdBy: number;

  @Column({ type: 'simple-enum', enum: VersionAction })
  action: VersionAction;

  @Column({ nullable: true })
  actionBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Annotation)
  @JoinColumn({ name: 'annotationId' })
  annotation: Annotation;
}
