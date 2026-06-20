import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cast_roles')
export class CastRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  characterName: string;

  @Column({ type: 'text', nullable: true })
  characterDescription: string;

  @Column({ nullable: true })
  actorId: number;

  @Column({ type: 'simple-json', nullable: true })
  substituteActorIds: number[];

  @Column({ type: 'simple-json', nullable: true })
  sceneNumbers: number[];

  @Column({ default: 0 })
  priority: number;

  @Column({ nullable: true })
  dramaId: number;

  @Column({ nullable: true })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
