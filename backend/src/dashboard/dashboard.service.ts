import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus, Rehearsal, CastRole, Annotation, Material } from '../entities';

export interface OverviewStats {
  users: {
    total: number;
    active: number;
    frozen: number;
    byRole: Record<string, number>;
  };
  rehearsals: {
    total: number;
    upcoming: number;
    ongoing: number;
    past: number;
    thisWeek: number;
  };
  roles: {
    total: number;
    withActor: number;
    withoutActor: number;
    withSubstitutes: number;
  };
  materials: {
    total: number;
    totalSize: number;
    byCategory: Record<string, number>;
  };
  annotations: {
    total: number;
    scenes: number;
    byTag: Record<string, number>;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
  ) {}

  async getOverview(): Promise<OverviewStats> {
    const [users, rehearsals, roles, annotations, materials] = await Promise.all([
      this.userRepo.find(),
      this.rehearsalRepo.find(),
      this.roleRepo.find(),
      this.annotationRepo.find(),
      this.materialRepo.find(),
    ]);

    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const userStats = {
      total: users.length,
      active: users.filter((u) => u.status === UserStatus.ACTIVE).length,
      frozen: users.filter((u) => u.status === UserStatus.FROZEN).length,
      byRole: {
        admin: users.filter((u) => u.role === UserRole.ADMIN).length,
        director: users.filter((u) => u.role === UserRole.DIRECTOR).length,
        actor: users.filter((u) => u.role === UserRole.ACTOR).length,
        viewer: users.filter((u) => u.role === UserRole.VIEWER).length,
      },
    };

    const rehearsalStats = {
      total: rehearsals.length,
      upcoming: rehearsals.filter((r) => r.startTime > now).length,
      ongoing: rehearsals.filter((r) => r.startTime <= now && r.endTime >= now).length,
      past: rehearsals.filter((r) => r.endTime < now).length,
      thisWeek: rehearsals.filter(
        (r) => r.startTime >= now && r.startTime <= oneWeekLater,
      ).length,
    };

    const roleStats = {
      total: roles.length,
      withActor: roles.filter((r) => r.actorId).length,
      withoutActor: roles.filter((r) => !r.actorId).length,
      withSubstitutes: roles.filter((r) => r.substituteActorIds && r.substituteActorIds.length > 0).length,
    };

    const categoryMap: Record<string, number> = {};
    materials.forEach((m) => {
      const cats = m.categories && m.categories.length > 0 ? m.categories : (m.category ? [m.category] : []);
      cats.forEach((c) => {
        categoryMap[c] = (categoryMap[c] || 0) + 1;
      });
    });

    const materialStats = {
      total: materials.length,
      totalSize: materials.reduce((sum, m) => sum + (m.size || 0), 0),
      byCategory: categoryMap,
    };

    const tagMap: Record<string, number> = {};
    const sceneSet = new Set<number | null>();
    annotations.forEach((a) => {
      if (a.tag) {
        tagMap[a.tag] = (tagMap[a.tag] || 0) + 1;
      }
      if (a.sceneNumber != null) {
        sceneSet.add(a.sceneNumber);
      }
    });

    const annotationStats = {
      total: annotations.length,
      scenes: sceneSet.size,
      byTag: tagMap,
    };

    return {
      users: userStats,
      rehearsals: rehearsalStats,
      roles: roleStats,
      materials: materialStats,
      annotations: annotationStats,
    };
  }
}
