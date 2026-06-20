import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal, CastRole, Annotation, Material, Performance } from '../entities';
import { RehearsalsModule } from '../rehearsals/rehearsals.module';
import { RolesModule } from '../roles/roles.module';
import { AnnotationsModule } from '../annotations/annotations.module';
import { MaterialsModule } from '../materials/materials.module';
import { PerformancesModule } from '../performances/performances.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rehearsal, CastRole, Annotation, Material, Performance]),
    RehearsalsModule,
    RolesModule,
    AnnotationsModule,
    MaterialsModule,
    PerformancesModule,
  ],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
