import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Annotation, AnnotationVersion } from '../entities';
import { AnnotationsService } from './annotations.service';
import { AnnotationsController } from './annotations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Annotation, AnnotationVersion])],
  providers: [AnnotationsService],
  controllers: [AnnotationsController],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
