import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Annotation, AnnotationVersion, Material, User } from '../entities';
import { AnnotationsService } from './annotations.service';
import { AnnotationsController } from './annotations.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Annotation, AnnotationVersion, Material, User]),
    NotificationsModule,
  ],
  providers: [AnnotationsService],
  controllers: [AnnotationsController],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
