import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag, TagRelation } from '../entities';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tag, TagRelation]),
    forwardRef(() => DramasModule),
  ],
  providers: [TagsService],
  controllers: [TagsController],
  exports: [TagsService],
})
export class TagsModule {}
