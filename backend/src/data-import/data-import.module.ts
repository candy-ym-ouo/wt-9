import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, CastRole, Rehearsal, Material } from '../entities';
import { DataImportService } from './data-import.service';
import { DataImportController } from './data-import.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CastRole, Rehearsal, Material]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
  ],
  providers: [DataImportService],
  controllers: [DataImportController],
  exports: [DataImportService],
})
export class DataImportModule {}
