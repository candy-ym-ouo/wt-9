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
  findAll(@Query('dramaId') dramaId: number, @Query('scene') scene?: string, @Request() req?: any) {
    if (scene) {
      return this.service.findByScene(Number(scene), dramaId, req.user.userId);
    }
    return this.service.findAll(dramaId, req.user.userId);
  }

  @Get('cross-drama')
  findAllCrossDrama(@Request() req: any) {
    return this.service.findAllCrossDrama(req.user.userId);
  }

  @Get('grouped/by-scene')
  findGroupedByScene(@Query('dramaId') dramaId: number, @Query('search') search?: string, @Request() req?: any) {
    return this.service.findGroupedByScene(dramaId, req.user.userId, search);
  }

  @Get('meta/tags')
  getTags(@Query('dramaId') dramaId: number, @Request() req: any) {
    return this.service.getAllTags(dramaId, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: number, @Request() req: any) {
    return this.service.getVersions(id, req.user.userId);
  }

  @Get(':id/versions/:versionId')
  getVersion(@Param('id') id: number, @Param('versionId') versionId: number, @Request() req: any) {
    return this.service.getVersion(versionId, req.user.userId);
  }

  @Post(':id/versions/:versionId/restore')
  restoreToVersion(
    @Param('id') id: number,
    @Param('versionId') versionId: number,
    @Request() req: any,
  ) {
    return this.service.restoreToVersion(id, versionId, req.user.userId, req.user.role, req.user.username);
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
      tagColor?: string;
      sceneNumber?: number;
      materialIds?: number[];
      dramaId: number;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      { ...body, createdBy: req.user.userId },
      body.dramaId,
      req.user.userId,
      req.user.username,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() body: Partial<Annotation>,
    @Request() req: any,
  ) {
    return this.service.update(id, body, req.user.userId, req.user.role, req.user.username);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.role, req.user.username);
  }
}
