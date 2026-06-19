import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  originalName: string;

  @Column()
  storedName: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
