import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal, User, CastRole, LeaveRequest, Material } from '../entities';
import { RehearsalsService } from './rehearsals.service';
import { RehearsalsController } from './rehearsals.controller';
import { LeavesModule } from '../leaves/leaves.module';

@Module({
  imports: [TypeOrmModule.forFeature([Rehearsal, User, CastRole, LeaveRequest, Material]), LeavesModule],
  providers: [RehearsalsService],
  controllers: [RehearsalsController],
  exports: [RehearsalsService],
})
export class RehearsalsModule {}
