import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Drama } from './drama.entity';
import { User } from './user.entity';

export enum DramaRole {
  OWNER = 'owner',
  DIRECTOR = 'director',
  ASSISTANT_DIRECTOR = 'assistant_director',
  ACTOR = 'actor',
  CREW = 'crew',
  VIEWER = 'viewer',
}

@Entity('drama_permissions')
export class DramaPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dramaId: number;

  @Column()
  userId: number;

  @Column({ type: 'simple-enum', enum: DramaRole, default: DramaRole.VIEWER })
  role: DramaRole;

  @Column({ type: 'simple-json', nullable: true })
  permissions: string[];

  @Column({ nullable: true })
  grantedBy: number;

  @ManyToOne(() => Drama, (drama) => drama.permissions)
  @JoinColumn({ name: 'dramaId' })
  drama: Drama;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
