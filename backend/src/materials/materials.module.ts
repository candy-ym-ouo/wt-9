import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material, Rehearsal, Annotation } from '../entities';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DramasModule } from '../dramas/dramas.module';
import { TagsModule } from '../tags/tags.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material, Rehearsal, Annotation]),
    forwardRef(() => AuditLogsModule),
    NotificationsModule,
    forwardRef(() => DramasModule),
    forwardRef(() => TagsModule),
    forwardRef(() => SubscriptionsModule),
  ],
  providers: [MaterialsService],
  controllers: [MaterialsController],
  exports: [MaterialsService],
})
export class MaterialsModule {}
