import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DramaPermission } from './drama-permission.entity';

export enum DramaStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  PLANNING = 'planning',
}

@Entity('dramas')
export class Drama {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  synopsis: string;

  @Column({ type: 'simple-json', nullable: true })
  genres: string[];

  @Column({ type: 'datetime', nullable: true })
  premiereDate: Date;

  @Column({ type: 'datetime', nullable: true })
  finalDate: Date;

  @Column({ nullable: true })
  venue: string;

  @Column({ type: 'simple-enum', enum: DramaStatus, default: DramaStatus.PLANNING })
  status: DramaStatus;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  createdBy: number;

  @OneToMany(() => DramaPermission, (permission) => permission.drama)
  permissions: DramaPermission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
