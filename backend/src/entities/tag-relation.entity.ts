import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum TagTargetType {
  ROLE = 'role',
  MATERIAL = 'material',
  ANNOTATION = 'annotation',
  REHEARSAL = 'rehearsal',
}

@Entity('tag_relations')
@Index(['tagId', 'targetType', 'targetId'], { unique: true })
export class TagRelation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tagId: number;

  @Column({ type: 'simple-enum', enum: TagTargetType })
  targetType: TagTargetType;

  @Column()
  targetId: number;

  @Column({ nullable: true })
  dramaId: number;

  @CreateDateColumn()
  createdAt: Date;
}
