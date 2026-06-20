import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('script_chapters')
export class ScriptChapter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scriptId: number;

  @Column()
  chapterNumber: number;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: 0 })
  sceneCount: number;

  @Column({ default: 0 })
  wordCount: number;

  @Column({ default: 0 })
  startOffset: number;

  @Column({ default: 0 })
  endOffset: number;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
