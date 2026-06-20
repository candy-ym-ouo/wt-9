import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User, UserRole, Rehearsal, Annotation, Material, Script } from '../entities';

export interface ReportsFilter {
  dateFrom?: string;
  dateTo?: string;
  actorId?: number;
  scriptId?: number;
  materialCategory?: string;
  annotationTag?: string;
}

export interface RehearsalFrequencyItem {
  date: string;
  count: number;
  totalMinutes: number;
}

export interface RehearsalFrequencyStats {
  total: number;
  totalMinutes: number;
  avgMinutes: number;
  byDate: RehearsalFrequencyItem[];
  byWeek: RehearsalFrequencyItem[];
  byMonth: RehearsalFrequencyItem[];
}

export interface ActorParticipationItem {
  actorId: number;
  actorName: string;
  totalRehearsals: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendanceRate: number;
}

export interface ActorParticipationStats {
  totalActors: number;
  avgAttendanceRate: number;
  items: ActorParticipationItem[];
}

export interface MaterialUsageItem {
  materialId: number;
  materialName: string;
  category: string;
  categories: string[];
  rehearsalCount: number;
  annotationCount: number;
  performanceCount: number;
  totalUsage: number;
}

export interface MaterialUsageStats {
  totalMaterials: number;
  totalUsed: number;
  byCategory: Record<string, number>;
  items: MaterialUsageItem[];
}

export interface AnnotationActivityItem {
  date: string;
  count: number;
}

export interface AnnotationActivityItemByUser {
  userId: number;
  userName: string;
  count: number;
}

export interface AnnotationActivityStats {
  total: number;
  byDate: AnnotationActivityItem[];
  byTag: Record<string, number>;
  byUser: AnnotationActivityItemByUser[];
}

export interface ReportsData {
  rehearsalFrequency: RehearsalFrequencyStats;
  actorParticipation: ActorParticipationStats;
  materialUsage: MaterialUsageStats;
  annotationActivity: AnnotationActivityStats;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(Script)
    private scriptRepo: Repository<Script>,
  ) {}

  private parseDate(d: string | undefined): Date | undefined {
    if (!d) return undefined;
    return new Date(d);
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private formatWeek(d: Date): string {
    const date = new Date(d);
    const day = date.getDay() || 7;
    if (day !== 1) date.setHours(-24 * (day - 1));
    return this.formatDate(date);
  }

  private formatMonth(d: Date): string {
    return d.toISOString().slice(0, 7);
  }

  async getReports(filter: ReportsFilter): Promise<ReportsData> {
    const dateFrom = this.parseDate(filter.dateFrom);
    const dateTo = filter.dateTo ? new Date(filter.dateTo + 'T23:59:59.999') : undefined;

    const rehearsalCondition = dateFrom && dateTo
      ? { startTime: Between(dateFrom, dateTo) }
      : dateFrom
        ? { startTime: Between(dateFrom, new Date()) }
        : {};

    const annotationCondition = dateFrom && dateTo
      ? { createdAt: Between(dateFrom, dateTo) }
      : dateFrom
        ? { createdAt: Between(dateFrom, new Date()) }
        : {};

    const [rehearsals, annotations, materials, users] = await Promise.all([
      this.rehearsalRepo.find({ where: rehearsalCondition as any }),
      this.annotationRepo.find({ where: annotationCondition as any }),
      this.materialRepo.find(),
      this.userRepo.find(),
    ]);

    const filteredRehearsals = this.filterRehearsals(rehearsals, filter);
    const filteredAnnotations = this.filterAnnotations(annotations, filter);
    const filteredMaterials = this.filterMaterials(materials, filter);

    return {
      rehearsalFrequency: this.computeRehearsalFrequency(filteredRehearsals),
      actorParticipation: this.computeActorParticipation(filteredRehearsals, users),
      materialUsage: this.computeMaterialUsage(filteredRehearsals, filteredAnnotations, filteredMaterials),
      annotationActivity: this.computeAnnotationActivity(filteredAnnotations, users),
    };
  }

  private filterRehearsals(rehearsals: Rehearsal[], filter: ReportsFilter): Rehearsal[] {
    return rehearsals.filter((r) => {
      if (filter.actorId) {
        const participants = r.participantIds || [];
        if (!participants.includes(filter.actorId)) return false;
      }
      return true;
    });
  }

  private filterAnnotations(annotations: Annotation[], filter: ReportsFilter): Annotation[] {
    return annotations.filter((a) => {
      if (filter.scriptId && a.scriptId !== filter.scriptId) return false;
      if (filter.annotationTag && a.tag !== filter.annotationTag) return false;
      if (filter.actorId && a.createdBy !== filter.actorId) return false;
      return true;
    });
  }

  private filterMaterials(materials: Material[], filter: ReportsFilter): Material[] {
    return materials.filter((m) => {
      if (filter.materialCategory) {
        const cats = m.categories && m.categories.length > 0 ? m.categories : (m.category ? [m.category] : []);
        if (!cats.includes(filter.materialCategory)) return false;
      }
      return true;
    });
  }

  private computeRehearsalFrequency(rehearsals: Rehearsal[]): RehearsalFrequencyStats {
    const byDateMap: Record<string, { count: number; totalMinutes: number }> = {};
    const byWeekMap: Record<string, { count: number; totalMinutes: number }> = {};
    const byMonthMap: Record<string, { count: number; totalMinutes: number }> = {};

    let totalMinutes = 0;

    rehearsals.forEach((r) => {
      const start = new Date(r.startTime);
      const end = new Date(r.endTime);
      const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      totalMinutes += minutes;

      const dk = this.formatDate(start);
      if (!byDateMap[dk]) byDateMap[dk] = { count: 0, totalMinutes: 0 };
      byDateMap[dk].count += 1;
      byDateMap[dk].totalMinutes += minutes;

      const wk = this.formatWeek(start);
      if (!byWeekMap[wk]) byWeekMap[wk] = { count: 0, totalMinutes: 0 };
      byWeekMap[wk].count += 1;
      byWeekMap[wk].totalMinutes += minutes;

      const mk = this.formatMonth(start);
      if (!byMonthMap[mk]) byMonthMap[mk] = { count: 0, totalMinutes: 0 };
      byMonthMap[mk].count += 1;
      byMonthMap[mk].totalMinutes += minutes;
    });

    const toList = (map: Record<string, { count: number; totalMinutes: number }>) =>
      Object.entries(map)
        .map(([date, v]) => ({ date, count: v.count, totalMinutes: v.totalMinutes }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total: rehearsals.length,
      totalMinutes,
      avgMinutes: rehearsals.length > 0 ? Math.round(totalMinutes / rehearsals.length) : 0,
      byDate: toList(byDateMap),
      byWeek: toList(byWeekMap),
      byMonth: toList(byMonthMap),
    };
  }

  private computeActorParticipation(rehearsals: Rehearsal[], users: User[]): ActorParticipationStats {
    const actorMap: Record<number, { total: number; present: number; absent: number; late: number }> = {};

    rehearsals.forEach((r) => {
      const participants = r.participantIds || [];
      const attendance = r.attendance || {};

      participants.forEach((pid) => {
        if (!actorMap[pid]) actorMap[pid] = { total: 0, present: 0, absent: 0, late: 0 };
        actorMap[pid].total += 1;
        const a = attendance[pid];
        if (a?.status === 'present') actorMap[pid].present += 1;
        else if (a?.status === 'absent') actorMap[pid].absent += 1;
        else if (a?.status === 'late') actorMap[pid].late += 1;
      });
    });

    const items: ActorParticipationItem[] = Object.entries(actorMap)
      .map(([idStr, v]) => {
        const id = Number(idStr);
        const user = users.find((u) => u.id === id);
        return {
          actorId: id,
          actorName: user?.displayName || user?.username || `用户${id}`,
          totalRehearsals: v.total,
          presentCount: v.present,
          absentCount: v.absent,
          lateCount: v.late,
          attendanceRate: v.total > 0 ? Math.round(((v.present + v.late * 0.5) / v.total) * 100) : 0,
        };
      })
      .sort((a, b) => b.attendanceRate - a.attendanceRate);

    const totalActors = items.length;
    const avgAttendanceRate =
      totalActors > 0 ? Math.round(items.reduce((s, it) => s + it.attendanceRate, 0) / totalActors) : 0;

    return { totalActors, avgAttendanceRate, items };
  }

  private computeMaterialUsage(
    rehearsals: Rehearsal[],
    annotations: Annotation[],
    materials: Material[],
  ): MaterialUsageStats {
    const rehearsalUsage: Record<number, number> = {};
    const annotationUsage: Record<number, number> = {};

    rehearsals.forEach((r) => {
      (r.materialIds || []).forEach((mid) => {
        rehearsalUsage[mid] = (rehearsalUsage[mid] || 0) + 1;
      });
    });

    annotations.forEach((a) => {
      (a.materialIds || []).forEach((mid) => {
        annotationUsage[mid] = (annotationUsage[mid] || 0) + 1;
      });
    });

    const allUsedIds = new Set([...Object.keys(rehearsalUsage), ...Object.keys(annotationUsage)].map(Number));

    const items: MaterialUsageItem[] = materials.map((m) => {
      const rCount = rehearsalUsage[m.id] || 0;
      const aCount = annotationUsage[m.id] || 0;
      return {
        materialId: m.id,
        materialName: m.originalName,
        category: m.category || '',
        categories: m.categories || [],
        rehearsalCount: rCount,
        annotationCount: aCount,
        performanceCount: 0,
        totalUsage: rCount + aCount,
      };
    });

    items.sort((a, b) => b.totalUsage - a.totalUsage);

    const byCategory: Record<string, number> = {};
    items.forEach((it) => {
      const cats = it.categories.length > 0 ? it.categories : (it.category ? [it.category] : []);
      cats.forEach((c) => {
        if (!c) return;
        byCategory[c] = (byCategory[c] || 0) + it.totalUsage;
      });
    });

    return {
      totalMaterials: materials.length,
      totalUsed: items.filter((i) => i.totalUsage > 0).length,
      byCategory,
      items,
    };
  }

  private computeAnnotationActivity(
    annotations: Annotation[],
    users: User[],
  ): AnnotationActivityStats {
    const byDateMap: Record<string, number> = {};
    const byTagMap: Record<string, number> = {};
    const byUserMap: Record<number, number> = {};

    annotations.forEach((a) => {
      const dk = this.formatDate(new Date(a.createdAt));
      byDateMap[dk] = (byDateMap[dk] || 0) + 1;

      if (a.tag) byTagMap[a.tag] = (byTagMap[a.tag] || 0) + 1;

      if (a.createdBy != null) byUserMap[a.createdBy] = (byUserMap[a.createdBy] || 0) + 1;
    });

    const byDate = Object.entries(byDateMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byUser = Object.entries(byUserMap)
      .map(([idStr, count]) => {
        const id = Number(idStr);
        const u = users.find((x) => x.id === id);
        return {
          userId: id,
          userName: u?.displayName || u?.username || `用户${id}`,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      total: annotations.length,
      byDate,
      byTag: byTagMap,
      byUser,
    };
  }

  async getFilterOptions() {
    const [users, scripts, materials] = await Promise.all([
      this.userRepo.find(),
      this.scriptRepo.find(),
      this.materialRepo.find(),
    ]);

    const actors = users
      .filter((u) => u.role === UserRole.ACTOR || u.role === UserRole.DIRECTOR)
      .map((u) => ({ id: u.id, name: u.displayName || u.username, role: u.role }));

    const scriptList = scripts.map((s) => ({ id: s.id, title: s.title }));

    const categorySet = new Set<string>();
    const tagSet = new Set<string>();
    materials.forEach((m) => {
      if (m.categories) m.categories.forEach((c) => categorySet.add(c));
      if (m.category) categorySet.add(m.category);
      if (m.tags) m.tags.forEach((t) => tagSet.add(t));
    });

    const annotations = await this.annotationRepo.find();
    const annotationTagSet = new Set<string>();
    annotations.forEach((a) => {
      if (a.tag) annotationTagSet.add(a.tag);
    });

    return {
      actors,
      scripts: scriptList,
      materialCategories: Array.from(categorySet).filter(Boolean),
      annotationTags: Array.from(annotationTagSet).filter(Boolean),
    };
  }
}
