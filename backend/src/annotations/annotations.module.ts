import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Annotation, AnnotationVersion, Material, User } from '../entities';
import { AnnotationsService } from './annotations.service';
import { AnnotationsController } from './annotations.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Annotation, AnnotationVersion, Material, User]),
    NotificationsModule,
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
    forwardRef(() => TagsModule),
  ],
  providers: [AnnotationsService],
  controllers: [AnnotationsController],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
