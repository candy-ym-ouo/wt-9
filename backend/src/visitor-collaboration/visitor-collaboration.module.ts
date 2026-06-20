import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Share,
  Visitor,
  VisitorAccessLog,
  User,
  Drama,
  DramaPermission,
  Script,
  CastRole,
  Rehearsal,
  Material,
} from '../entities';
import { SharesService } from './shares.service';
import { VisitorAccessService } from './visitor-access.service';
import { SharesController } from './shares.controller';
import { VisitorAccessController } from './visitor-access.controller';
import { ShareAuthGuard } from './share-auth.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DramasModule } from '../dramas/dramas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Share,
      Visitor,
      VisitorAccessLog,
      User,
      Drama,
      DramaPermission,
      Script,
      CastRole,
      Rehearsal,
      Material,
    ]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => DramasModule),
  ],
  providers: [SharesService, VisitorAccessService, ShareAuthGuard],
  controllers: [SharesController, VisitorAccessController],
  exports: [SharesService, VisitorAccessService, ShareAuthGuard],
})
export class VisitorCollaborationModule {}
