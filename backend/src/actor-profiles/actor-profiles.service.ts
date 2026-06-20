import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ActorProfile,
  ActorStatus,
  ActorGender,
  RehearsalAvailability,
  RehearsalAvailabilityException,
  Weekday,
  AvailabilityType,
  HistoricalRole,
  HistoricalRoleStatus,
  User,
  Material,
  LeaveRequest,
  LeaveStatus,
  CastRole,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ActorProfilesService {
  constructor(
    @InjectRepository(ActorProfile)
    private profileRepo: Repository<ActorProfile>,
    @InjectRepository(RehearsalAvailability)
    private availabilityRepo: Repository<RehearsalAvailability>,
    @InjectRepository(RehearsalAvailabilityException)
    private availabilityExceptionRepo: Repository<RehearsalAvailabilityException>,
    @InjectRepository(HistoricalRole)
    private historicalRoleRepo: Repository<HistoricalRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(LeaveRequest)
    private leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(CastRole)
    private castRoleRepo: Repository<CastRole>,
    private auditLogsService: AuditLogsService,
  ) {}

  // ==================== ActorProfile CRUD ====================

  async createProfile(data: Partial<ActorProfile>, operatorId: number, operatorName: string) {
    if (!data.userId) {
      throw new BadRequestException('必须关联用户ID');
    }
    const user = await this.userRepo.findOne({ where: { id: data.userId } });
    if (!user) {
      throw new NotFoundException('关联用户不存在');
    }

    const existing = await this.profileRepo.findOne({ where: { userId: data.userId } });
    if (existing) {
      throw new BadRequestException('该用户的演员档案已存在');
    }

    const item = this.profileRepo.create({
      ...data,
      createdBy: operatorId,
    });
    const saved = await this.profileRepo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ACTOR_PROFILE,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'actor_profile',
      targetUserId: saved.userId,
      targetUsername: user.username,
      detail: `创建演员档案「${saved.stageName || saved.realName || user.displayName || user.username}」`,
      metadata: { profileId: saved.id, userId: saved.userId },
    });

    return this.findOneProfile(saved.id);
  }

  async findAllProfiles(filters?: { status?: ActorStatus; keyword?: string }) {
    let qb = this.profileRepo.createQueryBuilder('p').orderBy('p.createdAt', 'DESC');

    if (filters?.status) {
      qb = qb.andWhere('p.status = :status', { status: filters.status });
    }

    if (filters?.keyword) {
      const kw = `%${filters.keyword}%`;
      qb = qb.andWhere(
        '(p.realName LIKE :kw OR p.stageName LIKE :kw OR p.phone LIKE :kw OR p.email LIKE :kw)',
        { kw },
      );
    }

    const profiles = await qb.getMany();
    return this.enrichProfiles(profiles);
  }

  async findOneProfile(id: number) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) return null;
    const enriched = await this.enrichProfiles([profile]);
    return enriched[0];
  }

  async findProfileByUserId(userId: number) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return null;
    return this.findOneProfile(profile.id);
  }

  async updateProfile(
    id: number,
    data: Partial<ActorProfile>,
    operatorId: number,
    operatorName: string,
  ) {
    const oldProfile = await this.profileRepo.findOne({ where: { id } });
    if (!oldProfile) {
      throw new NotFoundException('演员档案不存在');
    }

    await this.profileRepo.update(id, data);
    const updated = await this.findOneProfile(id);

    const changes: string[] = [];
    if (data.realName && data.realName !== oldProfile.realName) changes.push('真实姓名');
    if (data.stageName && data.stageName !== oldProfile.stageName) changes.push('艺名');
    if (data.gender !== undefined && data.gender !== oldProfile.gender) changes.push('性别');
    if (data.birthDate !== undefined) changes.push('出生日期');
    if (data.phone && data.phone !== oldProfile.phone) changes.push('电话');
    if (data.email && data.email !== oldProfile.email) changes.push('邮箱');
    if (data.status !== undefined && data.status !== oldProfile.status) {
      const statusLabels: Record<string, string> = { active: '活跃', inactive: '非活跃', suspended: '暂停' };
      changes.push(`状态: ${statusLabels[oldProfile.status]} → ${statusLabels[data.status]}`);
    }
    if (data.address !== undefined && data.address !== oldProfile.address) changes.push('地址');
    if (data.skills !== undefined) changes.push('技能');
    if (data.languages !== undefined) changes.push('语言');
    if (data.heightCm !== undefined && data.heightCm !== oldProfile.heightCm) changes.push('身高');
    if (data.weightKg !== undefined && data.weightKg !== oldProfile.weightKg) changes.push('体重');
    if (data.notes !== undefined && data.notes !== oldProfile.notes) changes.push('备注');

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ACTOR_PROFILE,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'actor_profile',
      targetUserId: oldProfile.userId,
      detail: changes.length > 0
        ? `更新演员档案「${oldProfile.stageName || oldProfile.realName || `#${id}`}」: ${changes.join('、')}`
        : `更新演员档案「${oldProfile.stageName || oldProfile.realName || `#${id}`}」`,
      metadata: { old: oldProfile, new: data },
    });

    return updated;
  }

  async removeProfile(id: number, operatorId: number, operatorName: string) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException('演员档案不存在');
    }

    await this.auditLogsService.log({
      action: AuditAction.DELETE_ACTOR_PROFILE,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'actor_profile',
      targetUserId: profile.userId,
      detail: `删除演员档案「${profile.stageName || profile.realName || `#${id}`}」`,
      metadata: { profileId: id, userId: profile.userId },
    });

    await this.availabilityRepo.delete({ actorProfileId: id });
    await this.availabilityExceptionRepo.delete({ actorProfileId: id });
    await this.historicalRoleRepo.delete({ actorProfileId: id });
    return this.profileRepo.delete(id);
  }

  // ==================== Rehearsal Availability ====================

  async getAvailabilities(profileId: number) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');
    return this.availabilityRepo.find({
      where: { actorProfileId: profileId },
      order: { weekday: 'ASC' },
    });
  }

  async updateAvailabilities(
    profileId: number,
    items: Array<Partial<RehearsalAvailability>>,
    operatorId: number,
    operatorName: string,
  ) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    await this.availabilityRepo.delete({ actorProfileId: profileId });

    const savedItems: RehearsalAvailability[] = [];
    for (const item of items) {
      const entity = this.availabilityRepo.create({
        ...item,
        actorProfileId: profileId,
        createdBy: operatorId,
      });
      const saved = await this.availabilityRepo.save(entity);
      savedItems.push(saved);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ACTOR_AVAILABILITY,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: profileId,
      targetType: 'actor_profile',
      targetUserId: profile.userId,
      detail: `更新演员「${profile.stageName || profile.realName || `#${profileId}`}」的排练时间 (${savedItems.length}条)`,
      metadata: { count: savedItems.length },
    });

    return savedItems;
  }

  async getAvailabilityExceptions(profileId: number, startDate?: string, endDate?: string) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    let qb = this.availabilityExceptionRepo
      .createQueryBuilder('e')
      .where('e.actorProfileId = :pid', { pid: profileId })
      .orderBy('e.date', 'ASC');

    if (startDate) qb = qb.andWhere('e.date >= :sd', { sd: startDate });
    if (endDate) qb = qb.andWhere('e.date <= :ed', { ed: endDate });

    return qb.getMany();
  }

  async createAvailabilityException(
    profileId: number,
    data: Partial<RehearsalAvailabilityException>,
    operatorId: number,
  ) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const item = this.availabilityExceptionRepo.create({
      ...data,
      actorProfileId: profileId,
      createdBy: operatorId,
    });
    return this.availabilityExceptionRepo.save(item);
  }

  async updateAvailabilityException(id: number, data: Partial<RehearsalAvailabilityException>) {
    const existing = await this.availabilityExceptionRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('例外记录不存在');
    await this.availabilityExceptionRepo.update(id, data);
    return this.availabilityExceptionRepo.findOne({ where: { id } });
  }

  async removeAvailabilityException(id: number) {
    const existing = await this.availabilityExceptionRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('例外记录不存在');
    return this.availabilityExceptionRepo.delete(id);
  }

  // ==================== Historical Roles ====================

  async getHistoricalRoles(profileId: number) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const roles = await this.historicalRoleRepo.find({
      where: { actorProfileId: profileId },
      order: { startDate: 'DESC' },
    });
    return this.enrichHistoricalRoles(roles);
  }

  async createHistoricalRole(
    profileId: number,
    data: Partial<HistoricalRole>,
    operatorId: number,
    operatorName: string,
  ) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const item = this.historicalRoleRepo.create({
      ...data,
      actorProfileId: profileId,
      createdBy: operatorId,
    });
    const saved = await this.historicalRoleRepo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_HISTORICAL_ROLE,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'historical_role',
      targetUserId: profile.userId,
      detail: `为演员「${profile.stageName || profile.realName || `#${profileId}`}」添加历史角色「${saved.characterName}」(${saved.productionName})`,
      metadata: { roleId: saved.id, profileId },
    });

    return this.enrichHistoricalRole(saved);
  }

  async updateHistoricalRole(
    id: number,
    data: Partial<HistoricalRole>,
    operatorId: number,
    operatorName: string,
  ) {
    const old = await this.historicalRoleRepo.findOne({ where: { id } });
    if (!old) throw new NotFoundException('历史角色不存在');

    await this.historicalRoleRepo.update(id, data);
    const updated = await this.historicalRoleRepo.findOne({ where: { id } });

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_HISTORICAL_ROLE,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'historical_role',
      detail: `更新历史角色「${old.characterName}」(${old.productionName})`,
      metadata: { old, new: data },
    });

    return this.enrichHistoricalRole(updated!);
  }

  async removeHistoricalRole(
    id: number,
    operatorId: number,
    operatorName: string,
  ) {
    const old = await this.historicalRoleRepo.findOne({ where: { id } });
    if (!old) throw new NotFoundException('历史角色不存在');

    await this.auditLogsService.log({
      action: AuditAction.DELETE_HISTORICAL_ROLE,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'historical_role',
      detail: `删除历史角色「${old.characterName}」(${old.productionName})`,
      metadata: { roleId: id },
    });

    return this.historicalRoleRepo.delete(id);
  }

  // ==================== Actor Materials ====================

  async getProfileMaterials(profileId: number) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const materialIds = profile.materialIds || [];
    if (materialIds.length === 0) return [];

    const materials = await this.materialRepo.findByIds(materialIds);
    return materials;
  }

  async bindMaterial(
    profileId: number,
    materialId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material) throw new NotFoundException('素材不存在');

    const ids = profile.materialIds || [];
    if (!ids.includes(materialId)) {
      ids.push(materialId);
      await this.profileRepo.update(profileId, { materialIds: ids });

      await this.auditLogsService.log({
        action: AuditAction.BIND_ACTOR_MATERIAL,
        module: AuditModule.ACTOR_PROFILE,
        operatorId,
        operatorName,
        targetId: profileId,
        targetType: 'actor_profile',
        targetUserId: profile.userId,
        detail: `为演员「${profile.stageName || profile.realName || `#${profileId}`}」绑定素材「${material.originalName}」`,
        metadata: { profileId, materialId },
      });
    }
    return this.findOneProfile(profileId);
  }

  async unbindMaterial(
    profileId: number,
    materialId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    const ids = (profile.materialIds || []).filter((id) => id !== materialId);
    await this.profileRepo.update(profileId, { materialIds: ids });

    await this.auditLogsService.log({
      action: AuditAction.UNBIND_ACTOR_MATERIAL,
      module: AuditModule.ACTOR_PROFILE,
      operatorId,
      operatorName,
      targetId: profileId,
      targetType: 'actor_profile',
      targetUserId: profile.userId,
      detail: `为演员「${profile.stageName || profile.realName || `#${profileId}`}」解绑素材「${material?.originalName || `#${materialId}`}」`,
      metadata: { profileId, materialId },
    });

    return this.findOneProfile(profileId);
  }

  // ==================== Actor Leaves ====================

  async getProfileLeaves(profileId: number, status?: LeaveStatus) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const where: any = { actorId: profile.userId };
    if (status) where.status = status;

    const leaves = await this.leaveRepo.find({ where, order: { createdAt: 'DESC' } });

    return leaves.map((l) => ({
      ...l,
      profileId,
    }));
  }

  // ==================== Current Roles ====================

  async getProfileCurrentRoles(profileId: number) {
    const profile = await this.profileRepo.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('演员档案不存在');

    const roles = await this.castRoleRepo.find({ order: { priority: 'ASC' } });
    const result = roles.filter(
      (r) =>
        r.actorId === profile.userId ||
        (r.substituteActorIds && r.substituteActorIds.includes(profile.userId)),
    );

    return result.map((r) => ({
      ...r,
      isMainActor: r.actorId === profile.userId,
      isSubstitute: r.substituteActorIds?.includes(profile.userId) || false,
    }));
  }

  // ==================== Profile Detail (All in one) ====================

  async getProfileDetail(id: number) {
    const profile = await this.findOneProfile(id);
    if (!profile) throw new NotFoundException('演员档案不存在');

    const [availabilities, exceptions, historicalRoles, leaves, currentRoles, materials] = await Promise.all([
      this.getAvailabilities(id),
      this.getAvailabilityExceptions(id),
      this.getHistoricalRoles(id),
      this.getProfileLeaves(id),
      this.getProfileCurrentRoles(id),
      this.getProfileMaterials(id),
    ]);

    return {
      ...profile,
      availabilities,
      availabilityExceptions: exceptions,
      historicalRoles,
      leaves,
      currentRoles,
      materials,
    };
  }

  // ==================== Statistics ====================

  async getStatistics() {
    const profiles = await this.profileRepo.find();
    const total = profiles.length;
    const active = profiles.filter((p) => p.status === ActorStatus.ACTIVE).length;
    const inactive = profiles.filter((p) => p.status === ActorStatus.INACTIVE).length;
    const suspended = profiles.filter((p) => p.status === ActorStatus.SUSPENDED).length;

    const genderCounts = {
      male: profiles.filter((p) => p.gender === ActorGender.MALE).length,
      female: profiles.filter((p) => p.gender === ActorGender.FEMALE).length,
      other: profiles.filter((p) => p.gender === ActorGender.OTHER).length,
      unknown: profiles.filter((p) => !p.gender).length,
    };

    const historicalRoleCount = await this.historicalRoleRepo.count();
    const avgRolesPerActor = total > 0 ? (historicalRoleCount / total).toFixed(1) : '0';

    const now = new Date();
    const activeLeaves = await this.leaveRepo.find({ where: { status: LeaveStatus.APPROVED } });
    const actorsOnLeave = new Set(
      activeLeaves.filter((l) => now >= l.startDate && now <= l.endDate).map((l) => l.actorId),
    ).size;

    return {
      total,
      byStatus: { active, inactive, suspended },
      byGender: genderCounts,
      historicalRoleCount,
      avgRolesPerActor,
      actorsOnLeave,
    };
  }

  // ==================== Private Helpers ====================

  private async enrichProfiles(profiles: ActorProfile[]) {
    if (profiles.length === 0) return [];

    const userIds = profiles.map((p) => p.userId);
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const profileIds = profiles.map((p) => p.id);
    const histRoles = await this.historicalRoleRepo.find({ where: { actorProfileId: In(profileIds) } });
    const roleCountMap = new Map<number, number>();
    histRoles.forEach((r) => {
      roleCountMap.set(r.actorProfileId, (roleCountMap.get(r.actorProfileId) || 0) + 1);
    });

    const currentRoles = await this.castRoleRepo.find();

    return profiles.map((p) => {
      const user = userMap.get(p.userId);
      const currentRoleCount = currentRoles.filter(
        (r) =>
          r.actorId === p.userId ||
          (r.substituteActorIds && r.substituteActorIds.includes(p.userId)),
      ).length;

      return {
        ...p,
        username: user?.username,
        displayName: user?.displayName,
        userRole: user?.role,
        userStatus: user?.status,
        historicalRoleCount: roleCountMap.get(p.id) || 0,
        currentRoleCount,
      };
    });
  }

  private async enrichHistoricalRole(role: HistoricalRole) {
    const materials = role.materialIds && role.materialIds.length > 0
      ? await this.materialRepo.findByIds(role.materialIds)
      : [];
    return { ...role, materials };
  }

  private async enrichHistoricalRoles(roles: HistoricalRole[]) {
    if (roles.length === 0) return [];
    const allMatIds = new Set<number>();
    roles.forEach((r) => (r.materialIds || []).forEach((id) => allMatIds.add(id)));
    const materials = allMatIds.size > 0 ? await this.materialRepo.findByIds(Array.from(allMatIds)) : [];
    const matMap = new Map(materials.map((m) => [m.id, m]));

    return roles.map((r) => ({
      ...r,
      materials: (r.materialIds || []).map((id) => matMap.get(id)).filter(Boolean),
    }));
  }
}
