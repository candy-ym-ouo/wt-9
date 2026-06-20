import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Drama } from './drama.entity';

export enum ShareTargetType {
  DRAMA = 'drama',
  SCRIPT = 'script',
  ROLE = 'role',
  REHEARSAL = 'rehearsal',
  MATERIAL = 'material',
}

export enum ShareStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum AccessScope {
  READ_ONLY = 'read_only',
  COMMENT = 'comment',
}

@Entity('shares')
export class Share {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: ShareTargetType })
  targetType: ShareTargetType;

  @Column()
  targetId: number;

  @Column()
  dramaId: number;

  @Column({ type: 'simple-enum', enum: AccessScope, default: AccessScope.READ_ONLY })
  accessScope: AccessScope;

  @Column({ default: false })
  allowDownload: boolean;

  @Column({ type: 'text', nullable: true })
  password: string | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ nullable: true, default: 0 })
  maxAccessCount: number;

  @Column({ default: 0 })
  accessCount: number;

  @Column({ type: 'simple-enum', enum: ShareStatus, default: ShareStatus.ACTIVE })
  status: ShareStatus;

  @Column({ type: 'simple-json', nullable: true })
  allowedIpRanges: string[];

  @Column({ type: 'text', nullable: true })
  token: string | null;

  @Column()
  createdBy: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @ManyToOne(() => Drama)
  @JoinColumn({ name: 'dramaId' })
  drama: Drama;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
