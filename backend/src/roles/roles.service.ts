import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CastRole, User } from '../entities';
import { LeavesService } from '../leaves/leaves.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(CastRole)
    private repo: Repository<CastRole>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private leavesService: LeavesService,
  ) {}

  async create(data: Partial<CastRole>) {
    const item = this.repo.create(data);
    return this.repo.save(item);
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

  async update(id: number, data: Partial<CastRole>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }

  async addSubstitute(roleId: number, actorId: number) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return null;

    const substitutes = role.substituteActorIds || [];
    if (!substitutes.includes(actorId)) {
      substitutes.push(actorId);
      await this.repo.update(roleId, { substituteActorIds: substitutes });
    }
    return this.findOne(roleId);
  }

  async removeSubstitute(roleId: number, actorId: number) {
    const role = await this.repo.findOne({ where: { id: roleId } });
    if (!role) return null;

    const substitutes = (role.substituteActorIds || []).filter((id) => id !== actorId);
    await this.repo.update(roleId, { substituteActorIds: substitutes });
    return this.findOne(roleId);
  }

  async updatePriorities(updates: Array<{ id: number; priority: number }>) {
    await Promise.all(
      updates.map(({ id, priority }) =>
        this.repo.update(id, { priority }),
      ),
    );
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
