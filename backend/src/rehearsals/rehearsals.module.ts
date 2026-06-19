import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal, User } from '../entities';
import { RehearsalsService } from './rehearsals.service';
import { RehearsalsController } from './rehearsals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rehearsal, User])],
  providers: [RehearsalsService],
  controllers: [RehearsalsController],
  exports: [RehearsalsService],
})
export class RehearsalsModule {}
