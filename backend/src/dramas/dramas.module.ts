import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drama, DramaPermission, User } from '../entities';
import { DramasService } from './dramas.service';
import { DramasController } from './dramas.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RolesModule } from '../roles/roles.module';
import { RehearsalsModule } from '../rehearsals/rehearsals.module';
import { MaterialsModule } from '../materials/materials.module';
import { AnnotationsModule } from '../annotations/annotations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drama, DramaPermission, User]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => RolesModule),
    forwardRef(() => RehearsalsModule),
    forwardRef(() => MaterialsModule),
    forwardRef(() => AnnotationsModule),
  ],
  controllers: [DramasController],
  providers: [DramasService],
  exports: [DramasService],
})
export class DramasModule {}
