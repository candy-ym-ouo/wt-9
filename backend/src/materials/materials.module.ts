import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from '../entities';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Material])],
  providers: [MaterialsService],
  controllers: [MaterialsController],
})
export class MaterialsModule {}
