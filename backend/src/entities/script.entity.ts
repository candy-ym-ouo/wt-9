import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ScriptStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ScriptFormat {
  PLAIN_TEXT = 'plain_text',
  FOUNTAIN = 'fountain',
  FINAL_DRAFT = 'final_draft',
  WORD = 'word',
}

@Entity('scripts')
export class Script {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  originalTitle: string;

  @Column({ type: 'text', nullable: true })
  author: string;

  @Column({ type: 'text', nullable: true })
  translator: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  synopsis: string;

  @Column({ type: 'simple-json', nullable: true })
  genre: string[];

  @Column({ nullable: true })
  estimatedDuration: number;

  @Column({ type: 'simple-enum', enum: ScriptStatus, default: ScriptStatus.DRAFT })
  status: ScriptStatus;

  @Column({ type: 'simple-enum', enum: ScriptFormat, default: ScriptFormat.PLAIN_TEXT })
  format: ScriptFormat;

  @Column({ type: 'text', nullable: true })
  sourceFileName: string;

  @Column({ type: 'text', nullable: true })
  sourceFileMime: string;

  @Column({ nullable: true })
  sourceFileSize: number;

  @Column({ type: 'text' })
  rawContent: string;

  @Column({ type: 'text', nullable: true })
  parsedContent: string;

  @Column({ default: 0 })
  chapterCount: number;

  @Column({ default: 0 })
  sceneCount: number;

  @Column({ default: 0 })
  wordCount: number;

  @Column({ default: 0 })
  characterCount: number;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @Column({ type: 'simple-json', nullable: true })
  characterNames: string[];

  @Column({ nullable: true })
  currentVersion: number;

  @Column({ nullable: true })
  createdBy: number;

  @Column({ nullable: true })
  updatedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
