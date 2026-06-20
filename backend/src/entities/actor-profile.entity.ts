import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ActorGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum ActorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('actor_profiles')
export class ActorProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ nullable: true })
  realName: string;

  @Column({ nullable: true })
  stageName: string;

  @Column({ type: 'simple-enum', enum: ActorGender, nullable: true })
  gender: ActorGender;

  @Column({ type: 'datetime', nullable: true })
  birthDate: Date | null;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'simple-enum', enum: ActorStatus, default: ActorStatus.ACTIVE })
  status: ActorStatus;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  emergencyContact: string;

  @Column({ type: 'text', nullable: true })
  emergencyPhone: string;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  skills: string[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  languages: string[];

  @Column({ type: 'int', nullable: true })
  heightCm: number | null;

  @Column({ type: 'int', nullable: true })
  weightKg: number | null;

  @Column({ nullable: true })
  avatarMaterialId: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  materialIds: number[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
