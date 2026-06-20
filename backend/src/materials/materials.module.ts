import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material, Rehearsal, Annotation } from '../entities';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Material, Rehearsal, Annotation]),
    AuditLogsModule,
    NotificationsModule,
  ],
  providers: [MaterialsService],
  controllers: [MaterialsController],
  exports: [MaterialsService],
})
export class MaterialsModule {}
