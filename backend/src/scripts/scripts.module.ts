import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Script,
  ScriptChapter,
  ScriptScene,
  ScriptVersion,
  Annotation,
} from '../entities';
import { ScriptsService } from './scripts.service';
import { ScriptsController } from './scripts.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Script, ScriptChapter, ScriptScene, ScriptVersion, Annotation]),
    AuditLogsModule,
  ],
  providers: [ScriptsService],
  controllers: [ScriptsController],
  exports: [ScriptsService],
})
export class ScriptsModule {}
