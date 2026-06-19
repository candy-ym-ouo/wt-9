import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('annotations')
export class Annotation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
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

  @Column({ type: 'simple-json', nullable: true })
  materialIds: number[];

  @Column({ nullable: true })
  createdBy: number;

  @Column({ nullable: true })
  sceneNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
