import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { RoomReservation } from './room-reservation.entity';

export enum RoomStatus {
  AVAILABLE = 'available',
  MAINTENANCE = 'maintenance',
  DISABLED = 'disabled',
}

@Entity('rehearsal_rooms')
export class RehearsalRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'simple-json', nullable: true })
  facilities: string[];

  @Column({ nullable: true })
  area: number;

  @Column({ nullable: true })
  floor: string;

  @Column({ type: 'simple-json', nullable: true })
  availableTimeSlots: string[];

  @Column({
    type: 'text',
    default: RoomStatus.AVAILABLE,
  })
  status: RoomStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  createdBy: number;

  @OneToMany(() => RoomReservation, (reservation) => reservation.room)
  reservations: RoomReservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
