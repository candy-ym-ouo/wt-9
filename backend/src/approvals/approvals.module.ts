import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Approval, User, CastRole, Material, Performance } from '../entities';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Approval, User, CastRole, Material, Performance]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
  ],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
