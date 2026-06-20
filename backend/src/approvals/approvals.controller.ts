import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApprovalsService, CreateApprovalParams } from './approvals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, ApprovalType, ApprovalStatus } from '../entities';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}

  @Get()
  findAll(
    @Query('dramaId') dramaId: number,
    @Query('type') type: ApprovalType,
    @Query('status') status: ApprovalStatus,
    @Query('requesterId') requesterId: number,
    @Query('approverId') approverId: number,
    @Query('keyword') keyword: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Request() req: any,
  ) {
    return this.service.findAll(
      { dramaId, type, status, requesterId, approverId, keyword, dateFrom, dateTo, limit, offset },
      req.user.userId,
    );
  }

  @Get('mine')
  findMyApprovals(@Query('status') status: ApprovalStatus, @Request() req: any) {
    return this.service.findMyApprovals(req.user.userId, status);
  }

  @Get('requested')
  findMyRequested(@Query('status') status: ApprovalStatus, @Request() req: any) {
    return this.service.findMyRequested(req.user.userId, status);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    return this.service.getStats(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  @Post()
  create(
    @Body()
    body: {
      type: ApprovalType;
      title: string;
      description?: string;
      dramaId?: number;
      targetId: number;
      targetType: string;
      targetData?: Record<string, any>;
      approverIds: number[];
    },
    @Request() req: any,
  ) {
    return this.service.create(
      body as CreateApprovalParams,
      req.user.userId,
      req.user.username,
    );
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: number,
    @Body() body: { comment?: string },
    @Request() req: any,
  ) {
    return this.service.approve(id, body.comment || '', req.user.userId, req.user.username);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: number,
    @Body() body: { comment: string },
    @Request() req: any,
  ) {
    return this.service.reject(id, body.comment, req.user.userId, req.user.username);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: number, @Request() req: any) {
    return this.service.cancel(id, req.user.userId, req.user.username);
  }
}
