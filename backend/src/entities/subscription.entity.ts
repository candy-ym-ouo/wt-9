import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SubscriptionTargetType {
  REHEARSAL = 'rehearsal',
  ROLE = 'role',
  ANNOTATION = 'annotation',
  MATERIAL = 'material',
}

export enum SubscriptionType {
  SUBSCRIBE = 'subscribe',
  FAVORITE = 'favorite',
  BOTH = 'both',
}

@Entity('subscriptions')
@Index(['userId', 'targetType', 'targetId'], { unique: true })
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'simple-enum', enum: SubscriptionTargetType })
  targetType: SubscriptionTargetType;

  @Column()
  targetId: number;

  @Column({ nullable: true })
  dramaId: number;

  @Column({ type: 'simple-enum', enum: SubscriptionType, default: SubscriptionType.SUBSCRIBE })
  subscriptionType: SubscriptionType;

  @Column({ default: true })
  notifyOnUpdate: boolean;

  @Column({ default: true })
  notifyOnDelete: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
