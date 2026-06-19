import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rehearsals')
export class Rehearsal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime' })
  endTime: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'simple-json', nullable: true })
  participantIds: number[];

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
