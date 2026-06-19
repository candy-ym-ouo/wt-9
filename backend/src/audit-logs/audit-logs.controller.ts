import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, AuditAction, AuditModule } from '../entities';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get('meta')
  getMeta() {
    return {
      actions: Object.values(AuditAction),
      modules: Object.values(AuditModule),
      actionLabels: {
        [AuditAction.FREEZE_USER]: '冻结用户',
        [AuditAction.UNFREEZE_USER]: '解冻用户',
        [AuditAction.UPDATE_USER_ROLE]: '用户角色变更',
        [AuditAction.CREATE_USER]: '创建用户',
        [AuditAction.DELETE_USER]: '删除用户',
        [AuditAction.UPDATE_ROLE]: '更新角色',
        [AuditAction.CREATE_ROLE]: '创建角色',
        [AuditAction.DELETE_ROLE]: '删除角色',
        [AuditAction.ADD_ROLE_SUBSTITUTE]: '添加替补演员',
        [AuditAction.REMOVE_ROLE_SUBSTITUTE]: '移除替补演员',
        [AuditAction.UPDATE_ROLE_PRIORITY]: '更新角色优先级',
        [AuditAction.CREATE_MATERIAL]: '上传素材',
        [AuditAction.UPDATE_MATERIAL]: '更新素材',
        [AuditAction.DELETE_MATERIAL]: '删除素材',
        [AuditAction.CREATE_REHEARSAL]: '创建排练',
        [AuditAction.UPDATE_REHEARSAL]: '更新排练',
        [AuditAction.DELETE_REHEARSAL]: '删除排练',
        [AuditAction.UPDATE_ATTENDANCE]: '更新考勤',
      },
      moduleLabels: {
        [AuditModule.USER]: '用户管理',
        [AuditModule.ROLE]: '角色分配',
        [AuditModule.MATERIAL]: '素材管理',
        [AuditModule.REHEARSAL]: '排练管理',
      },
    };
  }

  @Get()
  findAll(
    @Query('targetUserId') targetUserId?: number,
    @Query('operatorId') operatorId?: number,
    @Query('action') action?: string,
    @Query('module') module?: string,
    @Query('targetType') targetType?: string,
    @Query('keyword') keyword?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.auditLogsService.findAll({
      targetUserId,
      operatorId,
      action,
      module,
      targetType,
      keyword,
      dateFrom,
      dateTo,
      limit,
      offset,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.auditLogsService.findOne(id);
  }
}
