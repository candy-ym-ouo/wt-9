import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CastRole } from '../entities';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CastRole])],
  providers: [RolesService],
  controllers: [RolesController],
})
export class RolesModule {}
