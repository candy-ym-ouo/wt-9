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

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  categories: string[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  tags: string[];

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  downloadRoles: string[];

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  baseName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  dramaId: number;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
