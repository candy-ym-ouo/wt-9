import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CastRole, User, Rehearsal, AuditAction, AuditModule, SubscriptionTargetType } from '../entities';
import { LeavesService } from '../leaves/leaves.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(CastRole)
    private repo: Repository<CastRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    private leavesService: LeavesService,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => DramasService))
    private dramasService: DramasService,
    @Inject(forwardRef(() => SubscriptionsService))
    private subscriptionsService: SubscriptionsService,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    data: Partial<CastRole>,
    dramaId: number,
    operatorId: number,
    operatorName: string,
  ) {
    await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director', 'assistant_director']);

    const item = this.repo.create({
      ...data,
      dramaId,
    });
    const saved = await this.repo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ROLE,
      module: AuditModule.ROLE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'role',
      detail: `在剧目 #${dramaId} 创建角色「${saved.characterName}」`,
      metadata: { characterName: saved.characterName, actorId: saved.actorId, dramaId },
    });

    const targetUserIds: number[] = [];
    if (saved.actorId) targetUserIds.push(saved.actorId);
    (saved.substituteActorIds || []).forEach((id) => targetUserIds.push(id));
    if (targetUserIds.length > 0) {
      this.notificationsService.notifyRoleChange(
        saved.id,
        'created',
        undefined,
        targetUserIds,
        operatorId,
      ).catch(() => {});
    }

    this.subscriptionsService.notifySubscribers(
      SubscriptionTargetType.ROLE,
      saved.id,
      'created',
      '新角色创建',
      `角色「${saved.characterName}」已创建${saved.actorId ? '\n饰演演员：已分配' : ''}`,
      { role: saved, dramaId },
      operatorId,
    ).catch(() => {});

    return this.findOne(saved.id, operatorId);
  }

  async findAll(dramaId: number | undefined, userId: number) {
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
      const roles = await this.repo.find({ where: { dramaId }, order: { priority: 'ASC' } });
      return this.enrichWithUserInfo(roles);
    } else {
      const dramaIds = await this.dramasService.getUserDramaIds(userId);
      if (dramaIds.length === 0) return [];
      const roles = await this.repo.find({ where: { dramaId: In(dramaIds) }, order: { priority: 'ASC' } });
      return this.enrichWithUserInfo(roles);
    }
  }

  async findAllCrossDrama(userId: number) {
    const dramaIds = await this.dramasService.getUserDramaIds(userId);
    if (dramaIds.length === 0) return [];
    const roles = await this.repo.find({ where: { dramaId: In(dramaIds) }, order: { priority: 'ASC' } });
    return this.enrichWithUserInfo(roles);
  }

  async findOne(id: number, userId: number) {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) return null;
    if (role.dramaId) {
      await this.dramasService.checkAccess(role.dramaId, userId, ['viewer']);
    }
    const enriched = await this.enrichWithUserInfo([role]);
    return enriched[0];
  }

  async findOneWithRehearsals(id: number, userId: number) {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) return null;
    if (role.dramaId) {
      await this.dramasService.checkAccess(role.dramaId, userId, ['viewer']);
    }
    const enriched = await this.enrichWithUserInfo([role]);
    const rehearsals = await this.getRoleRehearsals(id, userId);
    return { ...enriched[0], rehearsals };
  }

  async getRoleRehearsals(roleId: number, userId: number) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return [];
    if (role.dramaId) {
      await this.dramasService.checkAccess(role.dramaId, userId, ['viewer']);
    }

    const allRehearsals = await this.rehearsalRepo.find({
      where: role.dramaId ? { dramaId: role.dramaId } : {},
      order: { startTime: 'DESC' },
    });
    const actorIds = new Set<number>();
    if (role.actorId) actorIds.add(role.actorId);
    (role.substituteActorIds || []).forEach((id) => actorIds.add(id));

    const result = allRehearsals.filter((r) => {
      const participants = r.participantIds || [];
      return participants.some((pid) => actorIds.has(pid));
    });

    return result.map((r) => ({
      id: r.id,
      title: r.title,
      startTime: r.startTime,
      endTime: r.endTime,
      location: r.location,
      isMainActor: role.actorId ? (r.participantIds || []).includes(role.actorId) : false,
      isSubstitute: (role.substituteActorIds || []).some((sid) =>
        (r.participantIds || []).includes(sid),
      ),
    }));
  }

  async update(
    id: number,
    data: Partial<CastRole>,
    operatorId: number,
    operatorName: string,
  ) {
    const oldRole = await this.repo.findOne({ where: { id } });
    if (!oldRole) return null;
    if (oldRole.dramaId) {
      await this.dramasService.checkAccess(oldRole.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }

    await this.repo.update(id, data);
    const updated = await this.findOne(id, operatorId);

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
        metadata: { old: oldRole, new: data, dramaId: oldRole.dramaId },
      });

      const targetUserIds: number[] = [];
      if (data.actorId !== undefined) targetUserIds.push(data.actorId);
      if (oldRole.actorId && oldRole.actorId !== data.actorId) targetUserIds.push(oldRole.actorId);
      (oldRole.substituteActorIds || []).forEach((id) => targetUserIds.push(id));
      (data.substituteActorIds || []).forEach((id) => targetUserIds.push(id));
      const uniqueTargetIds = Array.from(new Set(targetUserIds));
      if (uniqueTargetIds.length > 0) {
        this.notificationsService.notifyRoleChange(
          id,
          'updated',
          changes.length > 0 ? changes : undefined,
          uniqueTargetIds,
          operatorId,
        ).catch(() => {});
      }

      this.subscriptionsService.notifySubscribers(
        SubscriptionTargetType.ROLE,
        id,
        'updated',
        '角色更新通知',
        `角色「${oldRole.characterName}」已更新${changes.length > 0 ? '\n变更内容：' + changes.join('；') : ''}`,
        { old: oldRole, new: data, changes, dramaId: oldRole.dramaId },
        operatorId,
      ).catch(() => {});
    }

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) return null;
    if (role.dramaId) {
      await this.dramasService.checkAccess(role.dramaId, operatorId, ['owner', 'director']);
    }

    if (role) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_ROLE,
        module: AuditModule.ROLE,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'role',
        detail: `删除角色「${role.characterName}」`,
        metadata: { characterName: role.characterName, actorId: role.actorId, dramaId: role.dramaId },
      });

      const targetUserIds: number[] = [];
      if (role.actorId) targetUserIds.push(role.actorId);
      (role.substituteActorIds || []).forEach((uid) => targetUserIds.push(uid));
      if (targetUserIds.length > 0) {
        this.notificationsService.notifyRoleChange(
          id,
          'deleted',
          undefined,
          targetUserIds,
          operatorId,
        ).catch(() => {});
      }

      this.subscriptionsService.notifySubscribers(
        SubscriptionTargetType.ROLE,
        id,
        'deleted',
        '角色删除通知',
        `角色「${role.characterName}」已被删除`,
        { role, dramaId: role.dramaId },
        operatorId,
      ).catch(() => {});
    }
    return this.repo.delete(id);
  }

  async addSubstitute(
    roleId: number,
    actorId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return null;
    if (role.dramaId) {
      await this.dramasService.checkAccess(role.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }

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
        metadata: { roleId, actorId, dramaId: role.dramaId },
      });
    }
    return this.findOne(roleId, operatorId);
  }

  async removeSubstitute(
    roleId: number,
    actorId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return null;
    if (role.dramaId) {
      await this.dramasService.checkAccess(role.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }

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
      metadata: { roleId, actorId, dramaId: role.dramaId },
    });

    return this.findOne(roleId, operatorId);
  }

  async updatePriorities(
    updates: Array<{ id: number; priority: number }>,
    operatorId: number,
    operatorName: string,
  ) {
    const oldRoles = await Promise.all(
      updates.map(({ id }) => this.repo.findOne({ where: { id } })),
    );

    for (const role of oldRoles) {
      if (role?.dramaId) {
        await this.dramasService.checkAccess(role.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
      }
    }

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

    return this.findAllCrossDrama(operatorId);
  }

  async getStatsByDrama(dramaId: number): Promise<number> {
    return this.repo.count({ where: { dramaId } });
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
