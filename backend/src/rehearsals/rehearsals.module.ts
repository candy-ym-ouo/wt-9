import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal } from '../entities';
import { RehearsalsService } from './rehearsals.service';
import { RehearsalsController } from './rehearsals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rehearsal])],
  providers: [RehearsalsService],
  controllers: [RehearsalsController],
})
export class RehearsalsModule {}
