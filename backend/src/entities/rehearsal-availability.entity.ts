import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum Weekday {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export enum AvailabilityType {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  PREFER_NOT = 'prefer_not',
}

@Entity('rehearsal_availabilities')
export class RehearsalAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actorProfileId: number;

  @Column({ type: 'simple-enum', enum: Weekday })
  weekday: Weekday;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'simple-enum', enum: AvailabilityType, default: AvailabilityType.AVAILABLE })
  type: AvailabilityType;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('rehearsal_availability_exceptions')
export class RehearsalAvailabilityException {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actorProfileId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'simple-enum', enum: AvailabilityType, default: AvailabilityType.UNAVAILABLE })
  type: AvailabilityType;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
