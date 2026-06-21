import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import {
  PermissionTemplate,
  TemplateType,
  TemplateTargetScope,
  TemplateDramaRole,
  DramaPermission,
  DramaRole,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';

const SYSTEM_TEMPLATES: Partial<PermissionTemplate>[] = [
  {
    name: '管理员模板',
    description: '拥有全部菜单和操作的完整权限',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.DRAMA,
    dramaRole: TemplateDramaRole.ADMIN,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'materials', 'performances', 'budget', 'tasks', 'announcements', 'approvals', 'audit-logs', 'settings', 'tags', 'users', 'equipment', 'rehearsal-rooms'],
    operations: ['create', 'read', 'update', 'delete', 'manage_permissions', 'approve', 'export', 'import', 'archive', 'publish'],
  },
  {
    name: '导演模板',
    description: '可管理剧目排练、角色、剧本等核心内容',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.DRAMA,
    dramaRole: TemplateDramaRole.DIRECTOR,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'materials', 'performances', 'tasks', 'announcements', 'tags', 'equipment', 'rehearsal-rooms'],
    operations: ['create', 'read', 'update', 'approve', 'export'],
  },
  {
    name: '副导演模板',
    description: '可辅助管理排练和角色分配',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.DRAMA,
    dramaRole: TemplateDramaRole.ASSISTANT_DIRECTOR,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'materials', 'performances', 'tasks'],
    operations: ['create', 'read', 'update'],
  },
  {
    name: '演员模板',
    description: '可查看排练安排、剧本和公告',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.DRAMA,
    dramaRole: TemplateDramaRole.ACTOR,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'performances', 'announcements', 'tasks'],
    operations: ['read'],
  },
  {
    name: '剧组人员模板',
    description: '可管理物资和设备相关内容',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.DRAMA,
    dramaRole: TemplateDramaRole.CREW,
    menus: ['dashboard', 'dramas', 'materials', 'equipment', 'rehearsal-rooms', 'tasks'],
    operations: ['create', 'read', 'update'],
  },
  {
    name: '观众模板',
    description: '仅可查看公开信息',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.DRAMA,
    dramaRole: TemplateDramaRole.VIEWER,
    menus: ['dashboard', 'dramas', 'performances'],
    operations: ['read'],
  },
  {
    name: '团队管理员模板',
    description: '团队级别的完整管理权限',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.TEAM,
    dramaRole: TemplateDramaRole.ADMIN,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'materials', 'performances', 'budget', 'tasks', 'announcements', 'approvals', 'audit-logs', 'settings', 'tags', 'users', 'equipment', 'rehearsal-rooms'],
    operations: ['create', 'read', 'update', 'delete', 'manage_permissions', 'approve', 'export', 'import', 'archive', 'publish'],
  },
  {
    name: '团队导演模板',
    description: '团队级别可管理所有剧目的核心内容',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.TEAM,
    dramaRole: TemplateDramaRole.DIRECTOR,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'materials', 'performances', 'tasks', 'announcements', 'tags', 'equipment', 'rehearsal-rooms'],
    operations: ['create', 'read', 'update', 'approve', 'export'],
  },
  {
    name: '团队演员模板',
    description: '团队级别可查看参与的剧目和排练',
    templateType: TemplateType.SYSTEM,
    targetScope: TemplateTargetScope.TEAM,
    dramaRole: TemplateDramaRole.ACTOR,
    menus: ['dashboard', 'dramas', 'roles', 'rehearsals', 'scripts', 'performances', 'announcements', 'tasks'],
    operations: ['read'],
  },
];

@Injectable()
export class PermissionTemplatesService {
  constructor(
    @InjectRepository(PermissionTemplate)
    private templateRepo: Repository<PermissionTemplate>,
    @InjectRepository(DramaPermission)
    private permissionRepo: Repository<DramaPermission>,
    private auditLogsService: AuditLogsService,
    private dramasService: DramasService,
  ) {}

  async ensureSystemTemplates() {
    const existingSystem = await this.templateRepo.find({ where: { templateType: TemplateType.SYSTEM } });
    if (existingSystem.length > 0) return;

    for (const tpl of SYSTEM_TEMPLATES) {
      const entity = this.templateRepo.create(tpl);
      await this.templateRepo.save(entity);
    }
  }

  async findAll(userId: number, targetScope?: TemplateTargetScope, dramaId?: number) {
    await this.ensureSystemTemplates();

    const where: any = {};
    if (targetScope) where.targetScope = targetScope;
    if (dramaId) {
      where.dramaId = dramaId;
    }

    const templates = await this.templateRepo.find({
      where: dramaId
        ? [{ dramaId, targetScope: targetScope || undefined }]
        : targetScope
          ? [{ targetScope, templateType: TemplateType.SYSTEM }, { targetScope, dramaId: IsNull() }]
          : [],
      order: { templateType: 'ASC', dramaRole: 'ASC', name: 'ASC' },
    });

    return templates;
  }

  async findOne(id: number, userId: number) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('权限模板不存在');

    if (template.dramaId) {
      await this.dramasService.checkAccess(template.dramaId, userId, ['viewer']);
    }

    return template;
  }

  async create(
    data: {
      name: string;
      description?: string;
      targetScope: TemplateTargetScope;
      dramaRole: TemplateDramaRole;
      menus: string[];
      operations: string[];
      dramaId?: number;
    },
    operatorId: number,
    operatorName: string,
  ) {
    if (data.dramaId) {
      await this.dramasService.checkAccess(data.dramaId, operatorId, ['owner', 'director']);
    }

    const template = this.templateRepo.create({
      ...data,
      templateType: TemplateType.CUSTOM,
      createdBy: operatorId,
    });
    const saved = await this.templateRepo.save(template);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_PERMISSION_TEMPLATE,
      module: AuditModule.PERMISSION_TEMPLATE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'permission_template',
      detail: `创建权限模板「${saved.name}」(${saved.targetScope}/${saved.dramaRole})`,
      metadata: { name: saved.name, targetScope: saved.targetScope, dramaRole: saved.dramaRole, menus: saved.menus, operations: saved.operations, dramaId: saved.dramaId },
    });

    return saved;
  }

  async update(
    id: number,
    data: Partial<PermissionTemplate>,
    operatorId: number,
    operatorName: string,
  ) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('权限模板不存在');

    if (template.templateType === TemplateType.SYSTEM) {
      throw new ForbiddenException('系统模板不可修改');
    }

    if (template.dramaId) {
      await this.dramasService.checkAccess(template.dramaId, operatorId, ['owner', 'director']);
    }

    await this.templateRepo.update(id, data);
    const updated = await this.templateRepo.findOne({ where: { id } });

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_PERMISSION_TEMPLATE,
      module: AuditModule.PERMISSION_TEMPLATE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'permission_template',
      detail: `更新权限模板「${template.name}」`,
      metadata: { old: template, new: data },
    });

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('权限模板不存在');

    if (template.templateType === TemplateType.SYSTEM) {
      throw new ForbiddenException('系统模板不可删除');
    }

    if (template.dramaId) {
      await this.dramasService.checkAccess(template.dramaId, operatorId, ['owner', 'director']);
    }

    await this.auditLogsService.log({
      action: AuditAction.DELETE_PERMISSION_TEMPLATE,
      module: AuditModule.PERMISSION_TEMPLATE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'permission_template',
      detail: `删除权限模板「${template.name}」`,
      metadata: { name: template.name, targetScope: template.targetScope, dramaRole: template.dramaRole },
    });

    return this.templateRepo.delete(id);
  }

  async applyToDrama(
    templateId: number,
    dramaId: number,
    userIds: number[],
    operatorId: number,
    operatorName: string,
  ) {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('权限模板不存在');

    await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director']);

    const roleMapping: Record<TemplateDramaRole, DramaRole> = {
      [TemplateDramaRole.ADMIN]: DramaRole.OWNER,
      [TemplateDramaRole.DIRECTOR]: DramaRole.DIRECTOR,
      [TemplateDramaRole.ASSISTANT_DIRECTOR]: DramaRole.ASSISTANT_DIRECTOR,
      [TemplateDramaRole.ACTOR]: DramaRole.ACTOR,
      [TemplateDramaRole.CREW]: DramaRole.CREW,
      [TemplateDramaRole.VIEWER]: DramaRole.VIEWER,
    };

    const targetDramaRole = roleMapping[template.dramaRole];
    if (!targetDramaRole) throw new BadRequestException('无效的模板角色映射');

    const templatePermissions = [...template.menus, ...template.operations];

    const results: DramaPermission[] = [];
    for (const userId of userIds) {
      const existing = await this.permissionRepo.findOne({ where: { dramaId, userId } });
      if (existing) {
        existing.permissions = templatePermissions;
        results.push(await this.permissionRepo.save(existing));
      } else {
        const permission = this.permissionRepo.create({
          dramaId,
          userId,
          role: targetDramaRole,
          permissions: templatePermissions,
          grantedBy: operatorId,
        });
        results.push(await this.permissionRepo.save(permission));
      }
    }

    await this.auditLogsService.log({
      action: AuditAction.APPLY_PERMISSION_TEMPLATE,
      module: AuditModule.PERMISSION_TEMPLATE,
      operatorId,
      operatorName,
      targetId: dramaId,
      targetType: 'drama',
      detail: `将权限模板「${template.name}」应用到剧目 #${dramaId}，涉及 ${userIds.length} 位用户`,
      metadata: { templateId, templateName: template.name, dramaId, userIds, dramaRole: targetDramaRole },
    });

    return results;
  }

  async applyToTeam(
    templateId: number,
    dramaIds: number[],
    operatorId: number,
    operatorName: string,
  ) {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException('权限模板不存在');

    if (template.targetScope !== TemplateTargetScope.TEAM) {
      throw new BadRequestException('该模板不是团队级别模板');
    }

    const roleMapping: Record<TemplateDramaRole, DramaRole> = {
      [TemplateDramaRole.ADMIN]: DramaRole.OWNER,
      [TemplateDramaRole.DIRECTOR]: DramaRole.DIRECTOR,
      [TemplateDramaRole.ASSISTANT_DIRECTOR]: DramaRole.ASSISTANT_DIRECTOR,
      [TemplateDramaRole.ACTOR]: DramaRole.ACTOR,
      [TemplateDramaRole.CREW]: DramaRole.CREW,
      [TemplateDramaRole.VIEWER]: DramaRole.VIEWER,
    };

    const targetDramaRole = roleMapping[template.dramaRole];
    const templatePermissions = [...template.menus, ...template.operations];

    const results: DramaPermission[] = [];
    for (const dramaId of dramaIds) {
      await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director']);

      const matchingUsers = await this.permissionRepo.find({
        where: { dramaId, role: targetDramaRole },
      });

      for (const perm of matchingUsers) {
        perm.permissions = templatePermissions;
        results.push(await this.permissionRepo.save(perm));
      }
    }

    await this.auditLogsService.log({
      action: AuditAction.APPLY_PERMISSION_TEMPLATE,
      module: AuditModule.PERMISSION_TEMPLATE,
      operatorId,
      operatorName,
      targetId: 0,
      targetType: 'team',
      detail: `将团队权限模板「${template.name}」应用到 ${dramaIds.length} 个剧目，匹配角色 ${targetDramaRole}`,
      metadata: { templateId, templateName: template.name, dramaIds, dramaRole: targetDramaRole },
    });

    return results;
  }
}
