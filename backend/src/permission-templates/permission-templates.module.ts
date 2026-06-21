import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionTemplate, DramaPermission } from '../entities';
import { PermissionTemplatesService } from './permission-templates.service';
import { PermissionTemplatesController } from './permission-templates.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionTemplate, DramaPermission]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
  ],
  controllers: [PermissionTemplatesController],
  providers: [PermissionTemplatesService],
  exports: [PermissionTemplatesService],
})
export class PermissionTemplatesModule {}
