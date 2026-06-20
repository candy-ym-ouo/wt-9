import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rehearsal, CastRole, Annotation, Material, User } from '../entities';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rehearsal, CastRole, Annotation, Material, User]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
  ],
  providers: [DataExportService],
  controllers: [DataExportController],
  exports: [DataExportService],
})
export class DataExportModule {}
