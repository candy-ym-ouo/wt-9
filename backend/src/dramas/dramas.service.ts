import { Injectable, ForbiddenException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Drama, DramaStatus, DramaPermission, DramaRole, User, AuditAction, AuditModule } from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RolesService } from '../roles/roles.service';
import { RehearsalsService } from '../rehearsals/rehearsals.service';
import { MaterialsService } from '../materials/materials.service';
import { AnnotationsService } from '../annotations/annotations.service';

@Injectable()
export class DramasService {
  constructor(
    @InjectRepository(Drama)
    private dramaRepo: Repository<Drama>,
    @InjectRepository(DramaPermission)
    private permissionRepo: Repository<DramaPermission>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => RolesService))
    private rolesService: RolesService,
    @Inject(forwardRef(() => RehearsalsService))
    private rehearsalsService: RehearsalsService,
    @Inject(forwardRef(() => MaterialsService))
    private materialsService: MaterialsService,
    @Inject(forwardRef(() => AnnotationsService))
    private annotationsService: AnnotationsService,
  ) {}

  async create(data: Partial<Drama>, operatorId: number, operatorName: string) {
    const drama = this.dramaRepo.create({
      ...data,
      createdBy: operatorId,
    });
    const saved = await this.dramaRepo.save(drama);

    await this.grantPermission(saved.id, operatorId, DramaRole.OWNER, operatorId);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_DRAMA,
      module: AuditModule.DRAMA,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'drama',
      detail: `创建剧目「${saved.title}」`,
      metadata: { title: saved.title },
    });

    return this.findOne(saved.id, operatorId);
  }

  async findAll(userId: number, status?: DramaStatus) {
    const permissions = await this.permissionRepo.find({ where: { userId } });
    const dramaIds = permissions.map((p) => p.dramaId);

    if (dramaIds.length === 0) return [];

    const where: any = { id: In(dramaIds) };
    if (status) where.status = status;

    const dramas = await this.dramaRepo.find({ where, order: { updatedAt: 'DESC' } });
    return this.enrichWithPermissions(dramas, userId);
  }

  async findOne(id: number, userId: number) {
    await this.checkAccess(id, userId, ['viewer']);
    const drama = await this.dramaRepo.findOne({ where: { id } });
    if (!drama) return null;
    const enriched = await this.enrichWithPermissions([drama], userId);
    return enriched[0];
  }

  async update(id: number, data: Partial<Drama>, operatorId: number, operatorName: string) {
    await this.checkAccess(id, operatorId, ['owner', 'director']);

    const oldDrama = await this.dramaRepo.findOne({ where: { id } });
    if (!oldDrama) throw new NotFoundException('剧目不存在');

    await this.dramaRepo.update(id, data);
    const updated = await this.findOne(id, operatorId);

    const changes: string[] = [];
    if (data.title && data.title !== oldDrama.title) {
      changes.push(`名称: ${oldDrama.title} → ${data.title}`);
    }
    if (data.status !== undefined && data.status !== oldDrama.status) {
      changes.push(`状态: ${oldDrama.status} → ${data.status}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_DRAMA,
      module: AuditModule.DRAMA,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'drama',
      detail: changes.length > 0
        ? `更新剧目「${oldDrama.title}」: ${changes.join('; ')}`
        : `更新剧目「${oldDrama.title}」`,
      metadata: { old: oldDrama, new: data },
    });

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    await this.checkAccess(id, operatorId, ['owner']);

    const drama = await this.dramaRepo.findOne({ where: { id } });
    if (!drama) throw new NotFoundException('剧目不存在');

    await this.auditLogsService.log({
      action: AuditAction.DELETE_DRAMA,
      module: AuditModule.DRAMA,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'drama',
      detail: `删除剧目「${drama.title}」`,
      metadata: { title: drama.title },
    });

    await this.permissionRepo.delete({ dramaId: id });
    return this.dramaRepo.delete(id);
  }

  async grantPermission(dramaId: number, userId: number, role: DramaRole, grantedBy: number) {
    const existing = await this.permissionRepo.findOne({ where: { dramaId, userId } });
    if (existing) {
      existing.role = role;
      return this.permissionRepo.save(existing);
    }

    const permission = this.permissionRepo.create({
      dramaId,
      userId,
      role,
      grantedBy,
    });
    return this.permissionRepo.save(permission);
  }

  async revokePermission(dramaId: number, userId: number, operatorId: number, operatorName: string) {
    await this.checkAccess(dramaId, operatorId, ['owner', 'director']);

    const permission = await this.permissionRepo.findOne({ where: { dramaId, userId } });
    if (!permission) return null;

    if (permission.role === DramaRole.OWNER) {
      throw new ForbiddenException('不能撤销所有者权限');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const drama = await this.dramaRepo.findOne({ where: { id: dramaId } });

    await this.auditLogsService.log({
      action: AuditAction.REVOKE_DRAMA_PERMISSION,
      module: AuditModule.DRAMA,
      operatorId,
      operatorName,
      targetId: dramaId,
      targetType: 'drama',
      targetUserId: userId,
      targetUsername: user?.username,
      detail: `从剧目「${drama?.title}」撤销用户 ${user?.displayName || user?.username} 的权限`,
      metadata: { dramaId, userId, role: permission.role },
    });

    return this.permissionRepo.delete({ dramaId, userId });
  }

  async updatePermission(
    dramaId: number,
    userId: number,
    role: DramaRole,
    operatorId: number,
    operatorName: string,
  ) {
    await this.checkAccess(dramaId, operatorId, ['owner', 'director']);

    const permission = await this.permissionRepo.findOne({ where: { dramaId, userId } });
    if (!permission) {
      return this.grantPermission(dramaId, userId, role, operatorId);
    }

    const oldRole = permission.role;
    permission.role = role;
    const updated = await this.permissionRepo.save(permission);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const drama = await this.dramaRepo.findOne({ where: { id: dramaId } });

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_DRAMA_PERMISSION,
      module: AuditModule.DRAMA,
      operatorId,
      operatorName,
      targetId: dramaId,
      targetType: 'drama',
      targetUserId: userId,
      targetUsername: user?.username,
      detail: `更新剧目「${drama?.title}」中用户 ${user?.displayName || user?.username} 的权限: ${oldRole} → ${role}`,
      metadata: { dramaId, userId, oldRole, newRole: role },
    });

    return updated;
  }

  async getPermissions(dramaId: number, userId: number) {
    await this.checkAccess(dramaId, userId, ['viewer']);
    const permissions = await this.permissionRepo.find({ where: { dramaId } });
    return this.enrichPermissionsWithUserInfo(permissions);
  }

  async checkAccess(dramaId: number, userId: number, allowedRoles: string[]): Promise<boolean> {
    const permission = await this.permissionRepo.findOne({ where: { dramaId, userId } });
    if (!permission) {
      throw new ForbiddenException('您没有访问该剧目的权限');
    }

    const roleHierarchy: Record<string, number> = {
      owner: 100,
      director: 80,
      assistant_director: 60,
      actor: 40,
      crew: 30,
      viewer: 10,
    };

    const userRoleLevel = roleHierarchy[permission.role] || 0;
    const minRequiredLevel = Math.min(...allowedRoles.map((r) => roleHierarchy[r] || 0));

    if (userRoleLevel < minRequiredLevel) {
      throw new ForbiddenException('您的权限不足');
    }

    return true;
  }

  async getUserDramaIds(userId: number): Promise<number[]> {
    const permissions = await this.permissionRepo.find({ where: { userId } });
    return permissions.map((p) => p.dramaId);
  }

  private async enrichWithPermissions(dramas: Drama[], userId: number): Promise<any[]> {
    const dramaIds = dramas.map((d) => d.id);
    const permissions = await this.permissionRepo.find({ where: { dramaId: In(dramaIds), userId } });
    const permissionMap = new Map(permissions.map((p) => [p.dramaId, p]));

    return dramas.map((drama) => ({
      ...drama,
      userRole: permissionMap.get(drama.id)?.role,
      userPermissions: permissionMap.get(drama.id)?.permissions || [],
    }));
  }

  private async enrichPermissionsWithUserInfo(permissions: DramaPermission[]): Promise<any[]> {
    const userIds = permissions.map((p) => p.userId);
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return permissions.map((p) => ({
      ...p,
      user: {
        id: p.userId,
        username: userMap.get(p.userId)?.username,
        displayName: userMap.get(p.userId)?.displayName,
      },
    }));
  }

  async getStats(dramaId: number, userId: number) {
    await this.checkAccess(dramaId, userId, ['viewer']);
    const [roles, rehearsals, materials, annotations] = await Promise.all([
      this.rolesService.getStatsByDrama(dramaId),
      this.rehearsalsService.getStatsByDrama(dramaId),
      this.materialsService.getStatsByDrama(dramaId),
      this.annotationsService.getStatsByDrama(dramaId),
    ]);
    return {
      roles,
      rehearsals,
      materials,
      annotations,
    };
  }

  async searchDramas(query: string, userId: number) {
    const userDramaIds = await this.getUserDramaIds(userId);
    if (userDramaIds.length === 0) return [];

    const dramas = await this.dramaRepo
      .createQueryBuilder('drama')
      .where('drama.id IN (:...ids)', { ids: userDramaIds })
      .andWhere(
        '(drama.title LIKE :query OR drama.description LIKE :query OR drama.synopsis LIKE :query)',
        { query: `%${query}%` },
      )
      .getMany();

    return this.enrichWithPermissions(dramas, userId);
  }
}
