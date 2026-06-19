import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Annotation } from '../entities';
import { AnnotationsService } from './annotations.service';
import { AnnotationsController } from './annotations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Annotation])],
  providers: [AnnotationsService],
  controllers: [AnnotationsController],
})
export class AnnotationsModule {}
