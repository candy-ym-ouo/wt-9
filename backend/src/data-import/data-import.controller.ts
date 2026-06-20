import { Controller, Post, Get, Param, Body, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataImportService, ImportType, OverrideStrategy } from './data-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities';

@Controller('data-import')
@UseGuards(JwtAuthGuard)
export class DataImportController {
  constructor(private service: DataImportService) {}

  @Post('preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  preview(
    @Body()
    body: {
      type: ImportType;
      data: any[];
      dramaId?: number;
      strategy: OverrideStrategy;
    },
    @Request() req: any,
  ) {
    return this.service.preview(
      {
        type: body.type,
        data: body.data,
        dramaId: body.dramaId,
        strategy: body.strategy || OverrideStrategy.SKIP,
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Post('execute')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  execute(
    @Body()
    body: {
      type: ImportType;
      data: any[];
      dramaId?: number;
      strategy: OverrideStrategy;
    },
    @Request() req: any,
  ) {
    return this.service.execute(
      {
        type: body.type,
        data: body.data,
        dramaId: body.dramaId,
        strategy: body.strategy || OverrideStrategy.SKIP,
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Get(':taskId/errors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getErrorReceipt(@Param('taskId') taskId: string) {
    const result = this.service.getErrorReceipt(taskId);
    if (!result) {
      return { error: '导入任务不存在', taskId };
    }
    return result;
  }

  @Get(':taskId/errors/download')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async downloadErrorReceipt(@Param('taskId') taskId: string, @Res() res: Response) {
    const result = this.service.getErrorReceipt(taskId);
    if (!result) {
      res.status(404).json({ error: '导入任务不存在', taskId });
      return;
    }

    const lines: string[] = [];
    lines.push('数据导入错误回执');
    lines.push(`任务ID: ${result.taskId}`);
    lines.push(`导入时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`总记录数: ${result.totalRecords}`);
    lines.push(`成功创建: ${result.created}`);
    lines.push(`成功更新: ${result.updated}`);
    lines.push(`跳过: ${result.skipped}`);
    lines.push(`失败: ${result.failed}`);
    lines.push(`耗时: ${result.duration}ms`);
    lines.push('');
    lines.push('错误详情:');
    lines.push('行号\t字段\t错误信息');

    for (const err of result.errors) {
      lines.push(`${err.row + 1}\t${err.field || '-'}\t${err.message}`);
    }

    const csvContent = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=import_errors_${taskId}.csv`);
    res.send('\uFEFF' + csvContent);
  }
}
