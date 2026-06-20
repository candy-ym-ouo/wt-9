import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Performance, CastRole, User, Material } from '../entities';
import { PerformancesService } from './performances.service';
import { PerformancesController } from './performances.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Performance, CastRole, User, Material]),
    AuditLogsModule,
  ],
  providers: [PerformancesService],
  controllers: [PerformancesController],
  exports: [PerformancesService],
})
export class PerformancesModule {}
