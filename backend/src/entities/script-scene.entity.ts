import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SceneTimeOfDay {
  DAY = 'day',
  NIGHT = 'night',
  DAWN = 'dawn',
  DUSK = 'dusk',
  UNKNOWN = 'unknown',
}

export enum SceneLocationType {
  INT = 'int',
  EXT = 'ext',
  INT_EXT = 'int_ext',
  UNKNOWN = 'unknown',
}

@Entity('script_scenes')
export class ScriptScene {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scriptId: number;

  @Column({ nullable: true })
  chapterId: number;

  @Column()
  sceneNumber: number;

  @Column({ type: 'text', nullable: true })
  sceneKey: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ type: 'simple-enum', enum: SceneLocationType, default: SceneLocationType.UNKNOWN })
  locationType: SceneLocationType;

  @Column({ type: 'simple-enum', enum: SceneTimeOfDay, default: SceneTimeOfDay.UNKNOWN })
  timeOfDay: SceneTimeOfDay;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  characterNames: string[];

  @Column({ default: 0 })
  dialogueCount: number;

  @Column({ default: 0 })
  wordCount: number;

  @Column({ default: 0 })
  estimatedDuration: number;

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
