import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Share } from './share.entity';
import { Visitor } from './visitor.entity';

export enum VisitorAction {
  ACCESS = 'access',
  DOWNLOAD = 'download',
  PASSWORD_ATTEMPT = 'password_attempt',
  PASSWORD_SUCCESS = 'password_success',
}

@Entity('visitor_access_logs')
export class VisitorAccessLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shareId: number;

  @Column({ type: 'simple-enum', enum: VisitorAction })
  action: VisitorAction;

  @Column({ nullable: true })
  visitorId: number;

  @Column({ type: 'text', nullable: true })
  visitorName: string;

  @Column({ type: 'text', nullable: true })
  visitorEmail: string;

  @Column({ type: 'text', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'text', nullable: true })
  targetInfo: string;

  @Column({ default: false })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Share)
  @JoinColumn({ name: 'shareId' })
  share: Share;

  @ManyToOne(() => Visitor, { nullable: true })
  @JoinColumn({ name: 'visitorId' })
  visitor: Visitor;

  @CreateDateColumn()
  createdAt: Date;
}
