import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Rehearsal, CastRole, Annotation, Material, Performance, Script, ScriptChapter, ScriptScene, Task } from '../entities';
import { RehearsalsService } from '../rehearsals/rehearsals.service';
import { RolesService } from '../roles/roles.service';
import { AnnotationsService } from '../annotations/annotations.service';
import { MaterialsService } from '../materials/materials.service';
import { PerformancesService } from '../performances/performances.service';
import { ScriptsService } from '../scripts/scripts.service';
import { TasksService } from '../tasks/tasks.service';
import { DramasService } from '../dramas/dramas.service';

interface AdvancedSearchParams {
  query?: string;
  modules?: string[];
  dateFrom?: string;
  dateTo?: string;
  dateField?: 'createdAt' | 'updatedAt' | 'startTime';
  tags?: string[];
  sortBy?: 'date' | 'name' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  groupByModule?: boolean;
  dramaId?: number;
  userId: number;
}

export interface SearchResultItem {
  id: number;
  type: string;
  title: string;
  description?: string;
  date: Date;
  tags?: string[];
  raw: any;
}

const ENTITY_DATE_FIELDS: Record<string, string[]> = {
  rehearsal: ['startTime', 'createdAt', 'updatedAt'],
  role: ['createdAt', 'updatedAt'],
  annotation: ['createdAt', 'updatedAt'],
  material: ['createdAt', 'updatedAt'],
  performance: ['startTime', 'createdAt', 'updatedAt'],
  script: ['createdAt', 'updatedAt'],
  chapter: ['createdAt', 'updatedAt'],
  scene: ['createdAt', 'updatedAt'],
  task: ['createdAt', 'updatedAt', 'dueDate'],
};

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(Performance)
    private performanceRepo: Repository<Performance>,
    @InjectRepository(Script)
    private scriptRepo: Repository<Script>,
    @InjectRepository(ScriptChapter)
    private chapterRepo: Repository<ScriptChapter>,
    @InjectRepository(ScriptScene)
    private sceneRepo: Repository<ScriptScene>,
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    private rehearsalsService: RehearsalsService,
    private rolesService: RolesService,
    private annotationsService: AnnotationsService,
    private materialsService: MaterialsService,
    private performancesService: PerformancesService,
    private scriptsService: ScriptsService,
    private tasksService: TasksService,
    private dramasService: DramasService,
  ) {}

  private resolveDateColumn(entityType: string, dateField: string): string {
    const available = ENTITY_DATE_FIELDS[entityType];
    if (available.includes(dateField)) return dateField;
    return 'createdAt';
  }

  private resolveDateValue(raw: any, entityType: string, dateField: string): Date {
    const col = this.resolveDateColumn(entityType, dateField);
    const value = raw[col];
    return value ? new Date(value) : new Date(raw.createdAt);
  }

  private async getAccessibleDramaIds(dramaId: number | undefined, userId: number): Promise<number[]> {
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
      return [dramaId];
    }
    return this.dramasService.getUserDramaIds(userId);
  }

  async advancedSearch(params: AdvancedSearchParams) {
    const {
      query,
      modules = ['rehearsals', 'roles', 'annotations', 'materials', 'performances', 'scripts', 'tasks'],
      dateFrom,
      dateTo,
      dateField = 'createdAt',
      tags,
      sortBy = 'relevance',
      sortOrder = 'desc',
      groupByModule = true,
      dramaId,
      userId,
    } = params;

    const accessibleDramaIds = await this.getAccessibleDramaIds(dramaId, userId);
    if (accessibleDramaIds.length === 0) {
      return {
        rehearsals: [],
        roles: [],
        annotations: [],
        materials: [],
        performances: [],
        scripts: [],
        tasks: [],
        total: 0,
      };
    }

    const likeQuery = query ? `%${query}%` : null;

    const dateRange = this.getDateRange(dateFrom, dateTo);

    const searches: Promise<any[]>[] = [];

    if (modules.includes('rehearsals')) {
      searches.push(this.searchRehearsals(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('roles')) {
      searches.push(this.searchRoles(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('annotations')) {
      searches.push(this.searchAnnotations(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('materials')) {
      searches.push(this.searchMaterials(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('performances')) {
      searches.push(this.searchPerformances(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('scripts')) {
      searches.push(this.searchScripts(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('tasks')) {
      searches.push(this.searchTasks(likeQuery, dateRange, dateField, tags, accessibleDramaIds));
    } else {
      searches.push(Promise.resolve([]));
    }

    const [rehearsals, roles, annotations, materials, performances, scripts, tasks] = await Promise.all(searches);

    const rehearsalsWithConflicts = await this.rehearsalsService.enrichWithConflictInfo(rehearsals);
    const rehearsalsWithParticipants = await this.rehearsalsService.enrichWithParticipantInfo(rehearsals);
    const enrichedRehearsals = rehearsalsWithConflicts.map((r, i) => ({
      ...r,
      ...rehearsalsWithParticipants[i],
    }));

    const roleIds = roles.map((r) => r.id);
    const enrichedRoles: any[] = [];
    for (const roleId of roleIds) {
      const roleDetail = await this.rolesService.findOne(roleId, userId);
      if (roleDetail) {
        enrichedRoles.push(roleDetail);
      }
    }

    const highlightedAnnotations = query
      ? this.annotationsService.searchInScript(query, annotations)
      : annotations.map((a) => ({ ...a, highlights: [] }));

    const enrichedMaterials = await this.materialsService.enrichWithReferenceCounts(materials);

    const enrichedPerformances = await this.performancesService.enrichWithRoleAndMaterialInfo(performances);
    const performancesWithConflicts = await this.performancesService.enrichWithConflictInfo(performances);
    const finalPerformances = enrichedPerformances.map((p, i) => ({ ...p, ...performancesWithConflicts[i] }));

    const scriptSearchResults = query
      ? await this.scriptsService.fullTextSearch(query)
      : scripts.map((s: any) => ({
          id: s.id,
          type: 'script',
          title: s.title,
          description: s.description,
          highlights: [],
          score: 0,
          raw: s,
        }));

    const enrichedTasks = tasks.length > 0
      ? await this.tasksService.findAll()
      : [];
    const matchedTaskIds = new Set(tasks.map((t) => t.id));
    const filteredTasks = enrichedTasks.filter((t: any) => matchedTaskIds.has(t.id));

    const result = {
      rehearsals: enrichedRehearsals,
      roles: enrichedRoles,
      annotations: highlightedAnnotations,
      materials: enrichedMaterials,
      performances: finalPerformances,
      scripts: scriptSearchResults,
      tasks: filteredTasks,
      total: enrichedRehearsals.length + enrichedRoles.length + highlightedAnnotations.length + enrichedMaterials.length + finalPerformances.length + scriptSearchResults.length + filteredTasks.length,
    };

    if (!groupByModule) {
      const flatResults = this.flattenAndSort(result, sortBy, sortOrder, dateField, query);
      return { ...result, flatResults };
    }

    return result;
  }

  private getDateRange(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return null;
    return {
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
    };
  }

  private applyDateFilter(where: any, dateRange: { from?: Date; to?: Date } | null, field: string) {
    if (!dateRange) return where;
    if (dateRange.from && dateRange.to) {
      where[field] = Between(dateRange.from, dateRange.to);
    } else if (dateRange.from) {
      where[field] = MoreThanOrEqual(dateRange.from);
    } else if (dateRange.to) {
      where[field] = LessThanOrEqual(dateRange.to);
    }
    return where;
  }

  private async searchRehearsals(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    _tags?: string[],
    dramaIds?: number[],
  ) {
    const whereConditions: any[] = [];

    const baseConditions: any = {};
    if (dramaIds && dramaIds.length > 0) {
      baseConditions.dramaId = In(dramaIds);
    }

    if (likeQuery) {
      whereConditions.push(
        { ...baseConditions, title: Like(likeQuery) },
        { ...baseConditions, description: Like(likeQuery) },
        { ...baseConditions, location: Like(likeQuery) },
      );
    } else {
      whereConditions.push(baseConditions);
    }

    const dateFieldName = this.resolveDateColumn('rehearsal', dateField);

    if (dateRange) {
      whereConditions.forEach((w) => this.applyDateFilter(w, dateRange, dateFieldName));
    }

    return this.rehearsalRepo.find({ where: whereConditions });
  }

  private async searchRoles(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    _tags?: string[],
    dramaIds?: number[],
  ) {
    const whereConditions: any[] = [];

    const baseConditions: any = {};
    if (dramaIds && dramaIds.length > 0) {
      baseConditions.dramaId = In(dramaIds);
    }

    if (likeQuery) {
      whereConditions.push(
        { ...baseConditions, characterName: Like(likeQuery) },
        { ...baseConditions, characterDescription: Like(likeQuery) },
      );
    } else {
      whereConditions.push(baseConditions);
    }

    const dateFieldName = this.resolveDateColumn('role', dateField);

    if (dateRange) {
      whereConditions.forEach((w) => this.applyDateFilter(w, dateRange, dateFieldName));
    }

    return this.roleRepo.find({ where: whereConditions });
  }

  private async searchAnnotations(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
    dramaIds?: number[],
  ) {
    const whereConditions: any[] = [];

    const baseConditions: any = {};
    if (dramaIds && dramaIds.length > 0) {
      baseConditions.dramaId = In(dramaIds);
    }

    if (likeQuery) {
      whereConditions.push(
        { ...baseConditions, scriptContent: Like(likeQuery) },
        { ...baseConditions, note: Like(likeQuery) },
        { ...baseConditions, tag: Like(likeQuery) },
      );
    } else {
      whereConditions.push(baseConditions);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map((tag) => ({ tag: Like(`%${tag}%`) }));
      const combined: any[] = [];
      for (const wc of whereConditions) {
        for (const tc of tagConditions) {
          combined.push({ ...wc, ...tc });
        }
      }
      whereConditions.length = 0;
      whereConditions.push(...combined);
    }

    const dateFieldName = this.resolveDateColumn('annotation', dateField);

    if (dateRange) {
      whereConditions.forEach((w) => this.applyDateFilter(w, dateRange, dateFieldName));
    }

    return this.annotationRepo.find({ where: whereConditions });
  }

  private async searchMaterials(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
    dramaIds?: number[],
  ) {
    const qb = this.materialRepo.createQueryBuilder('m');

    const conditions: string[] = [];
    const params: any = {};

    if (dramaIds && dramaIds.length > 0) {
      conditions.push('m.dramaId IN (:...dramaIds)');
      params.dramaIds = dramaIds;
    }

    if (likeQuery) {
      conditions.push('(m.originalName LIKE :q OR m.description LIKE :q OR m.category LIKE :q OR m.categories LIKE :q OR m.tags LIKE :q)');
      params.q = likeQuery;
    }

    if (tags && tags.length > 0) {
      const tagConditions: string[] = [];
      tags.forEach((tag, i) => {
        tagConditions.push(`m.tags LIKE :tag${i}`);
        params[`tag${i}`] = `%${tag}%`;
      });
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    const dateFieldName = this.resolveDateColumn('material', dateField);

    if (dateRange?.from) {
      conditions.push(`m.${dateFieldName} >= :dateFrom`);
      params.dateFrom = dateRange.from;
    }
    if (dateRange?.to) {
      conditions.push(`m.${dateFieldName} <= :dateTo`);
      params.dateTo = dateRange.to;
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    return qb.getMany();
  }

  private async searchPerformances(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
    dramaIds?: number[],
  ) {
    const qb = this.performanceRepo.createQueryBuilder('p');

    const conditions: string[] = [];
    const params: any = {};

    if (dramaIds && dramaIds.length > 0) {
      conditions.push('p.dramaId IN (:...dramaIds)');
      params.dramaIds = dramaIds;
    }

    if (likeQuery) {
      conditions.push('(p.title LIKE :q OR p.description LIKE :q OR p.venue LIKE :q OR p.theater LIKE :q OR p.notes LIKE :q)');
      params.q = likeQuery;
    }

    if (tags && tags.length > 0) {
      const tagConditions: string[] = [];
      tags.forEach((tag, i) => {
        tagConditions.push(`p.tags LIKE :tag${i}`);
        params[`tag${i}`] = `%${tag}%`;
      });
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    const dateFieldName = this.resolveDateColumn('performance', dateField);

    if (dateRange?.from) {
      conditions.push(`p.${dateFieldName} >= :dateFrom`);
      params.dateFrom = dateRange.from;
    }
    if (dateRange?.to) {
      conditions.push(`p.${dateFieldName} <= :dateTo`);
      params.dateTo = dateRange.to;
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    return qb.getMany();
  }

  private async searchScripts(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
    dramaIds?: number[],
  ) {
    const qb = this.scriptRepo.createQueryBuilder('s');

    const conditions: string[] = [];
    const params: any = {};

    if (dramaIds && dramaIds.length > 0) {
      conditions.push('s.dramaId IN (:...dramaIds)');
      params.dramaIds = dramaIds;
    }

    if (likeQuery) {
      conditions.push('(s.title LIKE :q OR s.author LIKE :q OR s.description LIKE :q OR s.rawContent LIKE :q)');
      params.q = likeQuery;
    }

    if (tags && tags.length > 0) {
      const tagConditions: string[] = [];
      tags.forEach((tag, i) => {
        tagConditions.push(`s.tags LIKE :tag${i}`);
        params[`tag${i}`] = `%"${tag}"%`;
      });
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    const dateFieldName = this.resolveDateColumn('script', dateField);

    if (dateRange?.from) {
      conditions.push(`s.${dateFieldName} >= :dateFrom`);
      params.dateFrom = dateRange.from;
    }
    if (dateRange?.to) {
      conditions.push(`s.${dateFieldName} <= :dateTo`);
      params.dateTo = dateRange.to;
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    return qb.getMany();
  }

  private async searchTasks(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
    dramaIds?: number[],
  ) {
    const qb = this.taskRepo.createQueryBuilder('t');

    const conditions: string[] = [];
    const params: any = {};

    if (dramaIds && dramaIds.length > 0) {
      conditions.push('t.dramaId IN (:...dramaIds)');
      params.dramaIds = dramaIds;
    }

    if (likeQuery) {
      conditions.push('(t.title LIKE :q OR t.description LIKE :q OR t.category LIKE :q OR t.tags LIKE :q)');
      params.q = likeQuery;
    }

    if (tags && tags.length > 0) {
      const tagConditions: string[] = [];
      tags.forEach((tag, i) => {
        tagConditions.push(`t.tags LIKE :tag${i}`);
        params[`tag${i}`] = `%${tag}%`;
      });
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    const dateFieldName = this.resolveDateColumn('task', dateField);

    if (dateRange?.from) {
      conditions.push(`t.${dateFieldName} >= :dateFrom`);
      params.dateFrom = dateRange.from;
    }
    if (dateRange?.to) {
      conditions.push(`t.${dateFieldName} <= :dateTo`);
      params.dateTo = dateRange.to;
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), params);
    }

    return qb.getMany();
  }

  private flattenAndSort(result: any, sortBy: string, sortOrder: string, dateField: string, query?: string): SearchResultItem[] {
    const items: SearchResultItem[] = [];

    result.rehearsals.forEach((r: any) => {
      items.push({
        id: r.id,
        type: 'rehearsal',
        title: r.title,
        description: r.description,
        date: this.resolveDateValue(r, 'rehearsal', dateField),
        tags: r.location ? [r.location] : [],
        raw: r,
      });
    });

    result.roles.forEach((r: any) => {
      items.push({
        id: r.id,
        type: 'role',
        title: r.characterName,
        description: r.characterDescription,
        date: this.resolveDateValue(r, 'role', dateField),
        tags: [],
        raw: r,
      });
    });

    result.annotations.forEach((a: any) => {
      items.push({
        id: a.id,
        type: 'annotation',
        title: a.scriptContent?.substring(0, 50) + '...',
        description: a.note,
        date: this.resolveDateValue(a, 'annotation', dateField),
        tags: a.tag ? [a.tag] : [],
        raw: a,
      });
    });

    result.materials.forEach((m: any) => {
      items.push({
        id: m.id,
        type: 'material',
        title: m.originalName,
        description: m.description,
        date: this.resolveDateValue(m, 'material', dateField),
        tags: m.tags || [],
        raw: m,
      });
    });

    (result.performances || []).forEach((p: any) => {
      items.push({
        id: p.id,
        type: 'performance',
        title: p.title,
        description: p.description,
        date: this.resolveDateValue(p, 'performance', dateField),
        tags: p.tags || [],
        raw: p,
      });
    });

    (result.scripts || []).forEach((s: any) => {
      items.push({
        id: s.id,
        type: s.type || 'script',
        title: s.title,
        description: s.description,
        date: s.raw?.updatedAt ? new Date(s.raw.updatedAt) : new Date(),
        tags: s.raw?.tags || [],
        raw: s.raw || s,
      });
    });

    (result.tasks || []).forEach((t: any) => {
      items.push({
        id: t.id,
        type: 'task',
        title: t.title,
        description: t.description,
        date: this.resolveDateValue(t, 'task', dateField),
        tags: t.tags || [],
        raw: t,
      });
    });

    items.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'relevance':
        default:
          if (query) {
            const aRelevance = this.calculateRelevance(a, query);
            const bRelevance = this.calculateRelevance(b, query);
            comparison = aRelevance - bRelevance;
          } else {
            comparison = a.date.getTime() - b.date.getTime();
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return items;
  }

  private calculateRelevance(item: SearchResultItem, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    const title = item.title.toLowerCase();
    const description = (item.description || '').toLowerCase();

    if (title === lowerQuery) score += 100;
    else if (title.startsWith(lowerQuery)) score += 80;
    else if (title.includes(lowerQuery)) score += 60;

    if (description.includes(lowerQuery)) score += 30;

    item.tags?.forEach((tag) => {
      if (tag.toLowerCase().includes(lowerQuery)) score += 40;
    });

    return score;
  }

  async getAllTags(dramaId: number | undefined, userId: number) {
    const accessibleDramaIds = await this.getAccessibleDramaIds(dramaId, userId);
    if (accessibleDramaIds.length === 0) {
      return [];
    }

    const where: any = { dramaId: In(accessibleDramaIds) };

    const [annotations, materials, performances, scripts, tasks] = await Promise.all([
      this.annotationRepo.find({ where, select: ['tag', 'tagColor'] }),
      this.materialRepo.find({ where, select: ['tags'] }),
      this.performanceRepo.find({ where, select: ['tags'] }),
      this.scriptRepo.find({ where, select: ['tags'] }),
      this.taskRepo.find({ where, select: ['tags'] }),
    ]);

    const tagMap = new Map<string, string | null>();

    annotations.forEach((a) => {
      if (a.tag && !tagMap.has(a.tag)) {
        tagMap.set(a.tag, a.tagColor || null);
      }
    });

    materials.forEach((m) => {
      if (m.tags && Array.isArray(m.tags)) {
        m.tags.forEach((t) => {
          if (!tagMap.has(t)) tagMap.set(t, null);
        });
      }
    });

    performances.forEach((p) => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach((t) => {
          if (!tagMap.has(t)) tagMap.set(t, null);
        });
      }
    });

    scripts.forEach((s) => {
      if (s.tags && Array.isArray(s.tags)) {
        s.tags.forEach((t) => {
          if (!tagMap.has(t)) tagMap.set(t, null);
        });
      }
    });

    tasks.forEach((t) => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach((tag) => {
          if (!tagMap.has(tag)) tagMap.set(tag, null);
        });
      }
    });

    return Array.from(tagMap.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
}
