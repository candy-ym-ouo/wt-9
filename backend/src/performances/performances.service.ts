import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, MoreThanOrEqual, LessThanOrEqual, Like } from 'typeorm';
import {
  Performance,
  PerformanceStatus,
  CastRole,
  User,
  Material,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface PerformanceConflictInfo {
  hasConflict: boolean;
  timeConflicts: Performance[];
  venueConflicts: Performance[];
  theaterConflicts: Performance[];
}

export interface PerformanceRoleDetail {
  roleId: number;
  characterName: string;
  characterDescription?: string;
  priority: number;
  assignedActor?: {
    id: number;
    username?: string;
    displayName?: string;
  };
  assignedSubstitutes: Array<{
    id: number;
    username?: string;
    displayName?: string;
  }>;
  notes?: string;
}

export interface PerformanceMaterialDetail {
  materialId: number;
  originalName: string;
  mimeType: string;
  size: number;
  categories?: string[];
  description?: string;
}

@Injectable()
export class PerformancesService {
  constructor(
    @InjectRepository(Performance)
    private repo: Repository<Performance>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    private auditLogsService: AuditLogsService,
  ) {}

  private isTimeOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  async checkConflicts(
    startTime: Date,
    endTime: Date,
    excludeId?: number,
    venue?: string,
    theater?: string,
  ): Promise<PerformanceConflictInfo> {
    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const allPerformances = await this.repo.find();
    const others = excludeId
      ? allPerformances.filter((p) => p.id !== excludeId)
      : allPerformances;

    const timeConflicts: Performance[] = [];
    for (const p of others) {
      if (this.isTimeOverlap(startTime, endTime, p.startTime, p.endTime)) {
        timeConflicts.push(p);
      }
    }

    const venueConflicts: Performance[] = [];
    if (venue && venue.trim()) {
      const trimmed = venue.trim().toLowerCase();
      for (const p of others) {
        if (
          p.venue &&
          p.venue.trim().toLowerCase() === trimmed &&
          this.isTimeOverlap(startTime, endTime, p.startTime, p.endTime)
        ) {
          venueConflicts.push(p);
        }
      }
    }

    const theaterConflicts: Performance[] = [];
    if (theater && theater.trim()) {
      const trimmed = theater.trim().toLowerCase();
      for (const p of others) {
        if (
          p.theater &&
          p.theater.trim().toLowerCase() === trimmed &&
          this.isTimeOverlap(startTime, endTime, p.startTime, p.endTime)
        ) {
          theaterConflicts.push(p);
        }
      }
    }

    return {
      hasConflict:
        timeConflicts.length > 0 ||
        venueConflicts.length > 0 ||
        theaterConflicts.length > 0,
      timeConflicts,
      venueConflicts,
      theaterConflicts,
    };
  }

  async create(data: Partial<Performance>, operatorId: number, operatorName: string) {
    const startTime = data.startTime instanceof Date ? data.startTime : new Date(data.startTime!);
    const endTime = data.endTime instanceof Date ? data.endTime : new Date(data.endTime!);

    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const roleIds = data.roleIds || [];
    if (roleIds.length > 0) {
      const uniqueRoleIds = Array.from(new Set(roleIds));
      const roles = await this.roleRepo.findBy({ id: In(uniqueRoleIds) });
      if (roles.length !== uniqueRoleIds.length) {
        const foundIds = roles.map((r) => r.id);
        const missing = uniqueRoleIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(`角色ID不存在: ${missing.join(', ')}`);
      }
    }

    const materialIds = data.materialIds || [];
    if (materialIds.length > 0) {
      const uniqueMatIds = Array.from(new Set(materialIds));
      const mats = await this.materialRepo.findBy({ id: In(uniqueMatIds) });
      if (mats.length !== uniqueMatIds.length) {
        const foundIds = mats.map((m) => m.id);
        const missing = uniqueMatIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(`素材ID不存在: ${missing.join(', ')}`);
      }
    }

    if (data.venue && data.venue.trim()) {
      const conflict = await this.checkConflicts(startTime, endTime, undefined, data.venue);
      if (conflict.venueConflicts.length > 0) {
        const titles = conflict.venueConflicts.map((p) => p.title).join('、');
        throw new BadRequestException(`场馆「${data.venue}」在此时间段已被占用：${titles}`);
      }
    }

    if (data.theater && data.theater.trim()) {
      const conflict = await this.checkConflicts(startTime, endTime, undefined, undefined, data.theater);
      if (conflict.theaterConflicts.length > 0) {
        const titles = conflict.theaterConflicts.map((p) => p.title).join('、');
        throw new BadRequestException(`剧场「${data.theater}」在此时间段已被占用：${titles}`);
      }
    }

    const item = this.repo.create({
      ...data,
      startTime,
      endTime,
      roleIds,
      materialIds,
      tags: data.tags || [],
      castAssignments: data.castAssignments || {},
    });
    const saved = await this.repo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_PERFORMANCE,
      module: AuditModule.PERFORMANCE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'performance',
      detail: `创建演出场次「${saved.title}」(${saved.venue || saved.theater || '无场地'}, ${startTime.toLocaleString('zh-CN')} ~ ${endTime.toLocaleString('zh-CN')})`,
      metadata: {
        title: saved.title,
        venue: saved.venue,
        theater: saved.theater,
        startTime: saved.startTime,
        endTime: saved.endTime,
        roleIds: saved.roleIds,
        materialIds: saved.materialIds,
      },
    });

    return this.findOneWithDetails(saved.id);
  }

  async findAll() {
    return this.repo.find({ order: { startTime: 'ASC' } });
  }

  async findWithFilters(filters: {
    start?: string;
    end?: string;
    venue?: string;
    theater?: string;
    status?: PerformanceStatus;
    roleId?: string;
    keyword?: string;
    tags?: string;
  }) {
    let qb = this.repo.createQueryBuilder('p').orderBy('p.startTime', 'ASC');
    const params: Record<string, any> = {};
    const conditions: string[] = [];

    if (filters.start) {
      const startDate = new Date(filters.start);
      conditions.push('p.endTime >= :startDate');
      params.startDate = startDate;
    }
    if (filters.end) {
      const endDate = new Date(filters.end);
      conditions.push('p.startTime <= :endDate');
      params.endDate = endDate;
    }

    if (filters.venue) {
      conditions.push('p.venue LIKE :venue');
      params.venue = `%${filters.venue}%`;
    }

    if (filters.theater) {
      conditions.push('p.theater LIKE :theater');
      params.theater = `%${filters.theater}%`;
    }

    if (filters.status) {
      conditions.push('p.status = :status');
      params.status = filters.status;
    }

    if (filters.keyword) {
      conditions.push('(p.title LIKE :kw OR p.description LIKE :kw OR p.notes LIKE :kw)');
      params.kw = `%${filters.keyword}%`;
    }

    if (conditions.length > 0) {
      qb = qb.where(conditions.join(' AND '), params);
    }

    let result = await qb.getMany();

    if (filters.roleId) {
      const rid = parseInt(filters.roleId, 10);
      if (!isNaN(rid)) {
        result = result.filter((p) => p.roleIds?.includes(rid));
      }
    }

    if (filters.tags) {
      const tagList = filters.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        result = result.filter((p) => {
          const pTags = p.tags || [];
          return tagList.some((t) => pTags.includes(t));
        });
      }
    }

    return result;
  }

  async findByDateRange(start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const all = await this.repo.find({ order: { startTime: 'ASC' } });
    return all.filter((p) => this.isTimeOverlap(startDate, endDate, p.startTime, p.endTime));
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async findOneWithDetails(id: number) {
    const performance = await this.repo.findOne({ where: { id } });
    if (!performance) return null;

    const roleDetails = await this.getRoleDetails(id);
    const materialDetails = await this.getMaterialDetails(id);
    const conflictInfo = await this.checkConflicts(
      performance.startTime,
      performance.endTime,
      id,
      performance.venue,
      performance.theater,
    );

    return {
      ...performance,
      roles: roleDetails,
      materials: materialDetails,
      conflictInfo,
    };
  }

  async getRoleDetails(performanceId: number): Promise<PerformanceRoleDetail[]> {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) return [];

    const roleIds = performance.roleIds || [];
    if (roleIds.length === 0) return [];

    const roles = await this.roleRepo.findBy({ id: In(roleIds) });
    const castAssignments = performance.castAssignments || {};

    const userIdsToFetch = new Set<number>();
    roles.forEach((r) => {
      if (r.actorId) userIdsToFetch.add(r.actorId);
      (r.substituteActorIds || []).forEach((id) => userIdsToFetch.add(id));
    });

    Object.values(castAssignments).forEach((assignment) => {
      if (assignment.actorId) userIdsToFetch.add(assignment.actorId);
      (assignment.substituteActorIds || []).forEach((id) => userIdsToFetch.add(id));
    });

    const users = await this.userRepo.findByIds(Array.from(userIdsToFetch));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const detailMap = new Map(roles.map((r) => [r.id, r]));

    return roleIds
      .filter((rid) => detailMap.has(rid))
      .map((rid) => {
        const role = detailMap.get(rid)!;
        const assignment = castAssignments[rid] || {};
        const actorId = assignment.actorId ?? role.actorId;
        const substituteIds = assignment.substituteActorIds ?? role.substituteActorIds ?? [];

        return {
          roleId: rid,
          characterName: role.characterName,
          characterDescription: role.characterDescription,
          priority: role.priority,
          assignedActor: actorId
            ? {
                id: actorId,
                username: userMap.get(actorId)?.username,
                displayName: userMap.get(actorId)?.displayName,
              }
            : undefined,
          assignedSubstitutes: substituteIds
            .map((sid) => {
              const u = userMap.get(sid);
              return u
                ? { id: sid, username: u.username, displayName: u.displayName }
                : null;
            })
            .filter(Boolean) as any,
          notes: assignment.notes,
        };
      });
  }

  async getMaterialDetails(performanceId: number): Promise<PerformanceMaterialDetail[]> {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) return [];

    const materialIds = performance.materialIds || [];
    if (materialIds.length === 0) return [];

    const materials = await this.materialRepo.findBy({ id: In(materialIds) });
    const matMap = new Map(materials.map((m) => [m.id, m]));

    return materialIds
      .filter((mid) => matMap.has(mid))
      .map((mid) => {
        const m = matMap.get(mid)!;
        return {
          materialId: mid,
          originalName: m.originalName,
          mimeType: m.mimeType,
          size: m.size,
          categories: m.categories,
          description: m.description,
        };
      });
  }

  async update(
    id: number,
    data: Partial<Performance>,
    operatorId: number,
    operatorName: string,
  ) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new BadRequestException('演出场次不存在');
    }

    const startTime = data.startTime
      ? data.startTime instanceof Date
        ? data.startTime
        : new Date(data.startTime)
      : existing.startTime;
    const endTime = data.endTime
      ? data.endTime instanceof Date
        ? data.endTime
        : new Date(data.endTime)
      : existing.endTime;

    if (startTime >= endTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    let roleIds = existing.roleIds ?? [];
    if (data.roleIds !== undefined) {
      const uniqueRoleIds = Array.from(new Set(data.roleIds));
      if (uniqueRoleIds.length > 0) {
        const roles = await this.roleRepo.findBy({ id: In(uniqueRoleIds) });
        if (roles.length !== uniqueRoleIds.length) {
          const foundIds = roles.map((r) => r.id);
          const missing = uniqueRoleIds.filter((rid) => !foundIds.includes(rid));
          throw new BadRequestException(`角色ID不存在: ${missing.join(', ')}`);
        }
      }
      roleIds = uniqueRoleIds;
    }

    let materialIds = existing.materialIds ?? [];
    if (data.materialIds !== undefined) {
      const uniqueMatIds = Array.from(new Set(data.materialIds));
      if (uniqueMatIds.length > 0) {
        const mats = await this.materialRepo.findBy({ id: In(uniqueMatIds) });
        if (mats.length !== uniqueMatIds.length) {
          const foundIds = mats.map((m) => m.id);
          const missing = uniqueMatIds.filter((mid) => !foundIds.includes(mid));
          throw new BadRequestException(`素材ID不存在: ${missing.join(', ')}`);
        }
      }
      materialIds = uniqueMatIds;
    }

    const venue = data.venue !== undefined ? data.venue : existing.venue;
    const theater = data.theater !== undefined ? data.theater : existing.theater;

    if (venue && venue.trim()) {
      const conflict = await this.checkConflicts(startTime, endTime, id, venue);
      if (conflict.venueConflicts.length > 0) {
        const titles = conflict.venueConflicts.map((p) => p.title).join('、');
        throw new BadRequestException(`场馆「${venue}」在此时间段已被占用：${titles}`);
      }
    }

    if (theater && theater.trim()) {
      const conflict = await this.checkConflicts(startTime, endTime, id, undefined, theater);
      if (conflict.theaterConflicts.length > 0) {
        const titles = conflict.theaterConflicts.map((p) => p.title).join('、');
        throw new BadRequestException(`剧场「${theater}」在此时间段已被占用：${titles}`);
      }
    }

    const updateData: Partial<Performance> = {
      ...data,
      startTime,
      endTime,
      roleIds,
      materialIds,
    };
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.castAssignments !== undefined) updateData.castAssignments = data.castAssignments;

    await this.repo.update(id, updateData);

    const changes: string[] = [];
    if (data.title && data.title !== existing.title) {
      changes.push(`标题: ${existing.title} → ${data.title}`);
    }
    if (data.venue !== undefined && data.venue !== existing.venue) {
      changes.push(`场馆: ${existing.venue || '无'} → ${data.venue || '无'}`);
    }
    if (data.theater !== undefined && data.theater !== existing.theater) {
      changes.push(`剧场: ${existing.theater || '无'} → ${data.theater || '无'}`);
    }
    if (data.startTime || data.endTime) {
      changes.push(`时间排期变更`);
    }
    if (data.status !== undefined && data.status !== existing.status) {
      changes.push(`状态: ${existing.status} → ${data.status}`);
    }
    if (data.roleIds !== undefined) {
      changes.push(`角色绑定变更`);
    }
    if (data.materialIds !== undefined) {
      changes.push(`素材关联变更`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_PERFORMANCE,
      module: AuditModule.PERFORMANCE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'performance',
      detail: changes.length > 0
        ? `更新演出场次「${existing.title}」: ${changes.join('; ')}`
        : `更新演出场次「${existing.title}」`,
      metadata: { old: existing, new: data },
    });

    return this.findOneWithDetails(id);
  }

  async updateStatus(
    id: number,
    status: PerformanceStatus,
    operatorId: number,
    operatorName: string,
  ) {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new BadRequestException('演出场次不存在');
    }

    await this.repo.update(id, { status });

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_PERFORMANCE_STATUS,
      module: AuditModule.PERFORMANCE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'performance',
      detail: `更新演出场次「${existing.title}」状态: ${existing.status} → ${status}`,
      metadata: { oldStatus: existing.status, newStatus: status },
    });

    return this.findOneWithDetails(id);
  }

  async bindRole(
    performanceId: number,
    roleId: number,
    castAssignment?: {
      actorId?: number;
      substituteActorIds?: number[];
      notes?: string;
    },
    operatorId?: number,
    operatorName?: string,
  ) {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) {
      throw new BadRequestException('演出场次不存在');
    }

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException('角色不存在');
    }

    const roleIds = performance.roleIds || [];
    if (!roleIds.includes(roleId)) {
      roleIds.push(roleId);
    }

    const castAssignments = { ...(performance.castAssignments || {}) };
    if (castAssignment) {
      castAssignments[roleId] = castAssignment;
    }

    await this.repo.update(performanceId, {
      roleIds,
      castAssignments,
    });

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.BIND_PERFORMANCE_ROLE,
        module: AuditModule.PERFORMANCE,
        operatorId,
        operatorName,
        targetId: performanceId,
        targetType: 'performance',
        detail: `演出场次「${performance.title}」绑定角色「${role.characterName}」`,
        metadata: { performanceId, roleId, castAssignment },
      });
    }

    return this.findOneWithDetails(performanceId);
  }

  async unbindRole(
    performanceId: number,
    roleId: number,
    operatorId?: number,
    operatorName?: string,
  ) {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) {
      throw new BadRequestException('演出场次不存在');
    }

    const role = await this.roleRepo.findOne({ where: { id: roleId } });

    const roleIds = (performance.roleIds || []).filter((id) => id !== roleId);
    const castAssignments = { ...(performance.castAssignments || {}) };
    delete castAssignments[roleId];

    await this.repo.update(performanceId, {
      roleIds,
      castAssignments,
    });

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.UNBIND_PERFORMANCE_ROLE,
        module: AuditModule.PERFORMANCE,
        operatorId,
        operatorName,
        targetId: performanceId,
        targetType: 'performance',
        detail: `演出场次「${performance.title}」解绑角色「${role?.characterName || `#${roleId}`}」`,
        metadata: { performanceId, roleId },
      });
    }

    return this.findOneWithDetails(performanceId);
  }

  async updateRoleCast(
    performanceId: number,
    roleId: number,
    castAssignment: {
      actorId?: number;
      substituteActorIds?: number[];
      notes?: string;
    },
    operatorId?: number,
    operatorName?: string,
  ) {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) {
      throw new BadRequestException('演出场次不存在');
    }

    const roleIds = performance.roleIds || [];
    if (!roleIds.includes(roleId)) {
      throw new BadRequestException('该角色未绑定到此演出场次');
    }

    const castAssignments = { ...(performance.castAssignments || {}) };
    castAssignments[roleId] = castAssignment;

    await this.repo.update(performanceId, { castAssignments });

    return this.findOneWithDetails(performanceId);
  }

  async bindMaterial(
    performanceId: number,
    materialId: number,
    operatorId?: number,
    operatorName?: string,
  ) {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) {
      throw new BadRequestException('演出场次不存在');
    }

    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material) {
      throw new BadRequestException('素材不存在');
    }

    const materialIds = performance.materialIds || [];
    if (!materialIds.includes(materialId)) {
      materialIds.push(materialId);
    }

    await this.repo.update(performanceId, { materialIds });

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.BIND_PERFORMANCE_MATERIAL,
        module: AuditModule.PERFORMANCE,
        operatorId,
        operatorName,
        targetId: performanceId,
        targetType: 'performance',
        detail: `演出场次「${performance.title}」关联素材「${material.originalName}」`,
        metadata: { performanceId, materialId },
      });
    }

    return this.findOneWithDetails(performanceId);
  }

  async unbindMaterial(
    performanceId: number,
    materialId: number,
    operatorId?: number,
    operatorName?: string,
  ) {
    const performance = await this.repo.findOne({ where: { id: performanceId } });
    if (!performance) {
      throw new BadRequestException('演出场次不存在');
    }

    const material = await this.materialRepo.findOne({ where: { id: materialId } });

    const materialIds = (performance.materialIds || []).filter((id) => id !== materialId);

    await this.repo.update(performanceId, { materialIds });

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.UNBIND_PERFORMANCE_MATERIAL,
        module: AuditModule.PERFORMANCE,
        operatorId,
        operatorName,
        targetId: performanceId,
        targetType: 'performance',
        detail: `演出场次「${performance.title}」解除关联素材「${material?.originalName || `#${materialId}`}」`,
        metadata: { performanceId, materialId },
      });
    }

    return this.findOneWithDetails(performanceId);
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const performance = await this.repo.findOne({ where: { id } });
    if (performance) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_PERFORMANCE,
        module: AuditModule.PERFORMANCE,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'performance',
        detail: `删除演出场次「${performance.title}」`,
        metadata: {
          title: performance.title,
          venue: performance.venue,
          theater: performance.theater,
          startTime: performance.startTime,
          endTime: performance.endTime,
        },
      });
    }
    return this.repo.delete(id);
  }

  async getAllTags(): Promise<string[]> {
    const performances = await this.repo.find();
    const tagSet = new Set<string>();
    performances.forEach((p) => {
      if (p.tags) p.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }

  async getAllVenues(): Promise<string[]> {
    const performances = await this.repo.find({ where: {} });
    const venueSet = new Set<string>();
    performances.forEach((p) => {
      if (p.venue) venueSet.add(p.venue);
    });
    return Array.from(venueSet).sort();
  }

  async getAllTheaters(): Promise<string[]> {
    const performances = await this.repo.find();
    const theaterSet = new Set<string>();
    performances.forEach((p) => {
      if (p.theater) theaterSet.add(p.theater);
    });
    return Array.from(theaterSet).sort();
  }

  async enrichWithRoleAndMaterialInfo(performances: Performance[]) {
    const result: any[] = [];
    for (const p of performances) {
      const roleDetails = await this.getRoleDetails(p.id);
      const materialDetails = await this.getMaterialDetails(p.id);
      result.push({
        ...p,
        roles: roleDetails,
        materials: materialDetails,
        roleCount: roleDetails.length,
        materialCount: materialDetails.length,
      });
    }
    return result;
  }

  async enrichWithConflictInfo(performances: Performance[]) {
    const result: any[] = [];
    for (const p of performances) {
      const conflict = await this.checkConflicts(
        p.startTime,
        p.endTime,
        p.id,
        p.venue,
        p.theater,
      );
      result.push({
        ...p,
        hasConflict: conflict.hasConflict,
        timeConflicts: conflict.timeConflicts,
        venueConflicts: conflict.venueConflicts,
        theaterConflicts: conflict.theaterConflicts,
      });
    }
    return result;
  }
}
