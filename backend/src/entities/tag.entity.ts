import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TagCategory {
  ROLE = 'role',
  MATERIAL = 'material',
  ANNOTATION = 'annotation',
  REHEARSAL = 'rehearsal',
  GENERAL = 'general',
}

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  color: string;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  categories: TagCategory[];

  @Column({ nullable: true })
  dramaId: number;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
