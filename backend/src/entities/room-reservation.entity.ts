import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RehearsalRoom } from './rehearsal-room.entity';
import { User } from './user.entity';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum ReservationPurpose {
  REHEARSAL = 'rehearsal',
  MEETING = 'meeting',
  PERFORMANCE = 'performance',
  TRAINING = 'training',
  OTHER = 'other',
}

@Entity('room_reservations')
export class RoomReservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  roomId: number;

  @ManyToOne(() => RehearsalRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: RehearsalRoom;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  reserverName: string;

  @Column({ nullable: true })
  reserverPhone: string;

  @Column({
    type: 'text',
    default: ReservationPurpose.REHEARSAL,
  })
  purpose: ReservationPurpose;

  @Column({ type: 'text', nullable: true })
  purposeDetail: string;

  @Column({ type: 'simple-json', nullable: true })
  participantIds: number[];

  @Column({ type: 'int', default: 0 })
  participantCount: number;

  @Column({ type: 'simple-json', nullable: true })
  equipmentIds: number[];

  @Column({
    type: 'text',
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  rejectReason: string;

  @Column({ nullable: true })
  approvedBy: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
