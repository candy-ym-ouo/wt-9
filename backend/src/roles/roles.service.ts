import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CastRole, User, AuditAction, AuditModule } from '../entities';
import { LeavesService } from '../leaves/leaves.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(CastRole)
    private repo: Repository<CastRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private leavesService: LeavesService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(data: Partial<CastRole>, operatorId: number, operatorName: string) {
    const item = this.repo.create(data);
    const saved = await this.repo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ROLE,
      module: AuditModule.ROLE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'role',
      detail: `创建角色「${saved.characterName}」`,
      metadata: { characterName: saved.characterName, actorId: saved.actorId },
    });

    return this.findOne(saved.id);
  }

  async findAll() {
    const roles = await this.repo.find({ order: { priority: 'ASC' } });
    return this.enrichWithUserInfo(roles);
  }

  async findOne(id: number) {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) return null;
    const enriched = await this.enrichWithUserInfo([role]);
    return enriched[0];
  }

  async update(id: number, data: Partial<CastRole>, operatorId: number, operatorName: string) {
    const oldRole = await this.repo.findOne({ where: { id } });
    await this.repo.update(id, data);
    const updated = await this.findOne(id);

    if (oldRole) {
      const changes: string[] = [];
      if (data.characterName && data.characterName !== oldRole.characterName) {
        changes.push(`名称: ${oldRole.characterName} → ${data.characterName}`);
      }
      if (data.actorId !== undefined && data.actorId !== oldRole.actorId) {
        const oldActor = oldRole.actorId ? await this.userRepo.findOne({ where: { id: oldRole.actorId } }) : null;
        const newActor = data.actorId ? await this.userRepo.findOne({ where: { id: data.actorId } }) : null;
        changes.push(`演员: ${oldActor?.displayName || oldActor?.username || '无'} → ${newActor?.displayName || newActor?.username || '无'}`);
      }
      if (data.priority !== undefined && data.priority !== oldRole.priority) {
        changes.push(`优先级: ${oldRole.priority} → ${data.priority}`);
      }

      await this.auditLogsService.log({
        action: AuditAction.UPDATE_ROLE,
        module: AuditModule.ROLE,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'role',
        targetUserId: data.actorId,
        detail: changes.length > 0
          ? `更新角色「${oldRole.characterName}」: ${changes.join('; ')}`
          : `更新角色「${oldRole.characterName}」`,
        metadata: { old: oldRole, new: data },
      });
    }

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const role = await this.repo.findOne({ where: { id } });
    if (role) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_ROLE,
        module: AuditModule.ROLE,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'role',
        detail: `删除角色「${role.characterName}」`,
        metadata: { characterName: role.characterName, actorId: role.actorId },
      });
    }
    return this.repo.delete(id);
  }

  async addSubstitute(roleId: number, actorId: number, operatorId: number, operatorName: string) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return null;

    const actor = await this.userRepo.findOne({ where: { id: actorId } });
    const substitutes = role.substituteActorIds || [];
    if (!substitutes.includes(actorId)) {
      substitutes.push(actorId);
      await this.repo.update(roleId, { substituteActorIds: substitutes });

      await this.auditLogsService.log({
        action: AuditAction.ADD_ROLE_SUBSTITUTE,
        module: AuditModule.ROLE,
        operatorId,
        operatorName,
        targetId: roleId,
        targetType: 'role',
        targetUserId: actorId,
        targetUsername: actor?.username,
        detail: `为角色「${role.characterName}」添加替补演员 ${actor?.displayName || actor?.username || `#${actorId}`}`,
        metadata: { roleId, actorId },
      });
    }
    return this.findOne(roleId);
  }

  async removeSubstitute(roleId: number, actorId: number, operatorId: number, operatorName: string) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return null;

    const actor = await this.userRepo.findOne({ where: { id: actorId } });
    const substitutes = (role.substituteActorIds || []).filter((id) => id !== actorId);
    await this.repo.update(roleId, { substituteActorIds: substitutes });

    await this.auditLogsService.log({
      action: AuditAction.REMOVE_ROLE_SUBSTITUTE,
      module: AuditModule.ROLE,
      operatorId,
      operatorName,
      targetId: roleId,
      targetType: 'role',
      targetUserId: actorId,
      targetUsername: actor?.username,
      detail: `为角色「${role.characterName}」移除替补演员 ${actor?.displayName || actor?.username || `#${actorId}`}`,
      metadata: { roleId, actorId },
    });

    return this.findOne(roleId);
  }

  async updatePriorities(updates: Array<{ id: number; priority: number }>, operatorId: number, operatorName: string) {
    const oldRoles = await Promise.all(
      updates.map(({ id }) => this.repo.findOne({ where: { id } })),
    );

    await Promise.all(
      updates.map(({ id, priority }) =>
        this.repo.update(id, { priority }),
      ),
    );

    const changeDetails = updates
      .map((u, i) => {
        const old = oldRoles[i];
        return old ? `「${old.characterName}」: ${old.priority} → ${u.priority}` : '';
      })
      .filter(Boolean)
      .join('; ');

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ROLE_PRIORITY,
      module: AuditModule.ROLE,
      operatorId,
      operatorName,
      targetType: 'role',
      detail: `批量更新角色优先级: ${changeDetails}`,
      metadata: { updates },
    });

    return this.findAll();
  }

  private async enrichWithUserInfo(roles: CastRole[]): Promise<any[]> {
    const userIds = new Set<number>();
    roles.forEach((r) => {
      if (r.actorId) userIds.add(r.actorId);
      (r.substituteActorIds || []).forEach((id) => userIds.add(id));
    });

    const users = await this.userRepo.findByIds(Array.from(userIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const now = new Date();
    const activeLeaves = await this.leavesService.getActiveLeavesForDate(now);

    return roles.map((r) => {
      const actor = r.actorId ? userMap.get(r.actorId) : null;
      const actorOnLeave = activeLeaves.some((l) => l.actorId === r.actorId);
      const activeLeave = activeLeaves.find((l) => l.actorId === r.actorId);

      const substituteActors = (r.substituteActorIds || []).map((id) => {
        const u = userMap.get(id);
        const isOnLeave = activeLeaves.some((l) => l.actorId === id);
        return {
          id,
          username: u?.username,
          displayName: u?.displayName,
          isOnLeave,
        };
      });

      const availableSubstitutes = substituteActors.filter((s) => !s.isOnLeave);

      return {
        ...r,
        actorName: actor?.displayName || actor?.username,
        actorOnLeave,
        activeLeave: activeLeave || null,
        substituteActors,
        availableSubstituteCount: availableSubstitutes.length,
        currentSubstitute: availableSubstitutes.length > 0 ? availableSubstitutes[0] : null,
      };
    });
  }
}
