import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AnnotationsService } from './annotations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Annotation } from '../entities';

@Controller('annotations')
@UseGuards(JwtAuthGuard)
export class AnnotationsController {
  constructor(private service: AnnotationsService) {}

  @Get()
  findAll(@Query('scene') scene?: string, @Query('search') search?: string) {
    if (scene) {
      return this.service.findByScene(Number(scene));
    }
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: number) {
    return this.service.getVersions(id);
  }

  @Get(':id/versions/:versionId')
  getVersion(@Param('id') id: number, @Param('versionId') versionId: number) {
    return this.service.getVersion(versionId);
  }

  @Post(':id/versions/:versionId/restore')
  restoreToVersion(
    @Param('id') id: number,
    @Param('versionId') versionId: number,
    @Request() req: any,
  ) {
    return this.service.restoreToVersion(id, versionId, req.user.userId, req.user.role);
  }

  @Post()
  create(
    @Body()
    body: {
      scriptContent: string;
      note?: string;
      startOffset?: number;
      endOffset?: number;
      tag?: string;
      sceneNumber?: number;
    },
    @Request() req: any,
  ) {
    return this.service.create({ ...body, createdBy: req.user.userId }, req.user.userId);
  }

  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() body: Partial<Annotation>,
    @Request() req: any,
  ) {
    return this.service.update(id, body, req.user.userId, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.role);
  }
}
