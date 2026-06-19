import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  DIRECTOR = 'director',
  ACTOR = 'actor',
  VIEWER = 'viewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @Column({ nullable: true })
  displayName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
