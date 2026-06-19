import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal, CastRole, Annotation, Material } from '../entities';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rehearsal, CastRole, Annotation, Material])],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
