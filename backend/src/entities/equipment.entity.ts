import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RehearsalRoom } from './rehearsal-room.entity';

export enum EquipmentStatus {
  NORMAL = 'normal',
  IN_USE = 'in_use',
  MAINTENANCE = 'maintenance',
  DAMAGED = 'damaged',
  LOST = 'lost',
}

@Entity('equipment')
export class Equipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  category: string;

  @Column({ type: 'text', nullable: true })
  specification: string;

  @Column({ type: 'text', nullable: true })
  brand: string;

  @Column({ nullable: true })
  purchaseDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ nullable: true })
  roomId: number;

  @ManyToOne(() => RehearsalRoom, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roomId' })
  room: RehearsalRoom;

  @Column({
    type: 'text',
    default: EquipmentStatus.NORMAL,
  })
  status: EquipmentStatus;

  @Column({ type: 'text', nullable: true })
  maintenanceRecords: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
