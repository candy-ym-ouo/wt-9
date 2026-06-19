import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CastRole, User } from '../entities';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { LeavesModule } from '../leaves/leaves.module';

@Module({
  imports: [TypeOrmModule.forFeature([CastRole, User]), LeavesModule],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
