import { Controller, Post, Get, Query, Body, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataExportService, ExportType, ExportFormat, ExportFilter } from './data-export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities';

@Controller('data-export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get('types')
  getExportTypes() {
    return this.service.getAvailableTypes();
  }

  @Get('formats')
  getExportFormats() {
    return this.service.getAvailableFormats();
  }

  @Post('preview')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getPreview(
    @Body() body: { type: ExportType; filter: ExportFilter },
    @Request() req: any,
  ) {
    return this.service.getPreview(body.type, body.filter, req.user.userId);
  }

  @Post('export')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async exportData(
    @Body()
    body: {
      type: ExportType;
      format: ExportFormat;
      filter: ExportFilter;
    },
    @Request() req: any,
    @Res() res: Response,
  ) {
    const result = await this.service.export(
      body.type,
      body.format,
      body.filter,
      req.user.userId,
      req.user.username,
    );

    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });

    res.send(result.buffer);
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async exportDataGet(
    @Query('type') type: ExportType,
    @Query('format') format: ExportFormat,
    @Query('dramaId') dramaId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('participantId') participantId?: string,
    @Query('sceneNumber') sceneNumber?: string,
    @Query('tag') tag?: string,
    @Query('ids') ids?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const filter: ExportFilter = {
      dramaId: dramaId ? parseInt(dramaId, 10) : undefined,
      startDate,
      endDate,
      keyword,
      category,
      status,
      participantId: participantId ? parseInt(participantId, 10) : undefined,
      sceneNumber: sceneNumber ? parseInt(sceneNumber, 10) : undefined,
      tag,
      ids: ids ? ids.split(',').map((id) => parseInt(id, 10)) : undefined,
    };

    const result = await this.service.export(
      type,
      format,
      filter,
      req.user.userId,
      req.user.username,
    );

    res!.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });

    res!.send(result.buffer);
  }
}
