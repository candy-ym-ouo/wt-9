import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Rehearsal, CastRole, Annotation, Material } from '../entities';
import { RehearsalsService } from '../rehearsals/rehearsals.service';
import { RolesService } from '../roles/roles.service';
import { AnnotationsService } from '../annotations/annotations.service';

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
    private rehearsalsService: RehearsalsService,
    private rolesService: RolesService,
    private annotationsService: AnnotationsService,
  ) {}

  async advancedSearch(params: AdvancedSearchParams) {
    const {
      query,
      modules = ['rehearsals', 'roles', 'annotations', 'materials'],
      dateFrom,
      dateTo,
      dateField = 'createdAt',
      tags,
      sortBy = 'relevance',
      sortOrder = 'desc',
      groupByModule = true,
    } = params;

    const likeQuery = query ? `%${query}%` : null;

    const dateRange = this.getDateRange(dateFrom, dateTo);

    const searches: Promise<any[]>[] = [];

    if (modules.includes('rehearsals')) {
      searches.push(this.searchRehearsals(likeQuery, dateRange, dateField, tags));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('roles')) {
      searches.push(this.searchRoles(likeQuery, dateRange, dateField, tags));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('annotations')) {
      searches.push(this.searchAnnotations(likeQuery, dateRange, dateField, tags));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (modules.includes('materials')) {
      searches.push(this.searchMaterials(likeQuery, dateRange, dateField, tags));
    } else {
      searches.push(Promise.resolve([]));
    }

    const [rehearsals, roles, annotations, materials] = await Promise.all(searches);

    const rehearsalsWithConflicts = await this.rehearsalsService.enrichWithConflictInfo(rehearsals);
    const rehearsalsWithParticipants = await this.rehearsalsService.enrichWithParticipantInfo(rehearsals);
    const enrichedRehearsals = rehearsalsWithConflicts.map((r, i) => ({
      ...r,
      ...rehearsalsWithParticipants[i],
    }));

    const roleIds = roles.map((r) => r.id);
    const enrichedRoles: any[] = [];
    for (const roleId of roleIds) {
      const roleDetail = await this.rolesService.findOne(roleId);
      if (roleDetail) {
        enrichedRoles.push(roleDetail);
      }
    }

    const highlightedAnnotations = query
      ? this.annotationsService.searchInScript(query, annotations)
      : annotations.map((a) => ({ ...a, highlights: [] }));

    const result = {
      rehearsals: enrichedRehearsals,
      roles: enrichedRoles,
      annotations: highlightedAnnotations,
      materials,
      total: enrichedRehearsals.length + enrichedRoles.length + highlightedAnnotations.length + materials.length,
    };

    if (!groupByModule) {
      const flatResults = this.flattenAndSort(result, sortBy, sortOrder, query);
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
    tags?: string[],
  ) {
    const whereConditions: any[] = [];

    if (likeQuery) {
      whereConditions.push(
        { title: Like(likeQuery) },
        { description: Like(likeQuery) },
        { location: Like(likeQuery) },
      );
    }

    const dateFieldName = dateField === 'startTime' ? 'startTime' : 'createdAt';

    if (dateRange) {
      if (whereConditions.length === 0) {
        whereConditions.push(this.applyDateFilter({}, dateRange, dateFieldName));
      } else {
        whereConditions.forEach((w) => this.applyDateFilter(w, dateRange, dateFieldName));
      }
    }

    if (whereConditions.length === 0) {
      return this.rehearsalRepo.find();
    }

    return this.rehearsalRepo.find({ where: whereConditions });
  }

  private async searchRoles(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
  ) {
    const whereConditions: any[] = [];

    if (likeQuery) {
      whereConditions.push(
        { characterName: Like(likeQuery) },
        { characterDescription: Like(likeQuery) },
      );
    }

    const dateFieldName = 'createdAt';

    if (dateRange) {
      if (whereConditions.length === 0) {
        whereConditions.push(this.applyDateFilter({}, dateRange, dateFieldName));
      } else {
        whereConditions.forEach((w) => this.applyDateFilter(w, dateRange, dateFieldName));
      }
    }

    if (whereConditions.length === 0) {
      return this.roleRepo.find();
    }

    return this.roleRepo.find({ where: whereConditions });
  }

  private async searchAnnotations(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
  ) {
    const whereConditions: any[] = [];

    if (likeQuery) {
      whereConditions.push(
        { scriptContent: Like(likeQuery) },
        { note: Like(likeQuery) },
        { tag: Like(likeQuery) },
      );
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map((tag) => ({ tag: Like(`%${tag}%`) }));
      if (whereConditions.length === 0) {
        whereConditions.push(...tagConditions);
      } else {
        const combined: any[] = [];
        for (const wc of whereConditions) {
          for (const tc of tagConditions) {
            combined.push({ ...wc, ...tc });
          }
        }
        whereConditions.length = 0;
        whereConditions.push(...combined);
      }
    }

    const dateFieldName = 'createdAt';

    if (dateRange) {
      if (whereConditions.length === 0) {
        whereConditions.push(this.applyDateFilter({}, dateRange, dateFieldName));
      } else {
        whereConditions.forEach((w) => this.applyDateFilter(w, dateRange, dateFieldName));
      }
    }

    if (whereConditions.length === 0) {
      return this.annotationRepo.find();
    }

    return this.annotationRepo.find({ where: whereConditions });
  }

  private async searchMaterials(
    likeQuery: string | null,
    dateRange: { from?: Date; to?: Date } | null,
    dateField: string,
    tags?: string[],
  ) {
    const qb = this.materialRepo.createQueryBuilder('m');

    const conditions: string[] = [];
    const params: any = {};

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

    const dateFieldName = 'createdAt';

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

  private flattenAndSort(result: any, sortBy: string, sortOrder: string, query?: string): SearchResultItem[] {
    const items: SearchResultItem[] = [];

    result.rehearsals.forEach((r: any) => {
      items.push({
        id: r.id,
        type: 'rehearsal',
        title: r.title,
        description: r.description,
        date: r.startTime ? new Date(r.startTime) : new Date(r.createdAt),
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
        date: new Date(r.createdAt),
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
        date: new Date(a.createdAt),
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
        date: new Date(m.createdAt),
        tags: m.tags || [],
        raw: m,
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

  async getAllTags() {
    const [annotations, materials] = await Promise.all([
      this.annotationRepo.find({ select: ['tag'] }),
      this.materialRepo.find({ select: ['tags'] }),
    ]);

    const tagSet = new Set<string>();

    annotations.forEach((a) => {
      if (a.tag) tagSet.add(a.tag);
    });

    materials.forEach((m) => {
      if (m.tags && Array.isArray(m.tags)) {
        m.tags.forEach((t) => tagSet.add(t));
      }
    });

    return Array.from(tagSet).sort();
  }
}
