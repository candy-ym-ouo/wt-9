import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Annotation, AnnotationVersion, VersionAction, UserRole, Material } from '../entities';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private repo: Repository<Annotation>,
    @InjectRepository(AnnotationVersion)
    private versionRepo: Repository<AnnotationVersion>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
  ) {}

  private async createVersion(
    annotation: Annotation,
    action: VersionAction,
    actionBy: number,
  ) {
    const version = this.versionRepo.create({
      annotationId: annotation.id,
      scriptContent: annotation.scriptContent,
      note: annotation.note,
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      tag: annotation.tag,
      sceneNumber: annotation.sceneNumber,
      createdBy: annotation.createdBy,
      action,
      actionBy,
    });
    return this.versionRepo.save(version);
  }

  canModify(annotation: Annotation, userId: number, userRole: UserRole): boolean {
    if (userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR) {
      return true;
    }
    return annotation.createdBy === userId;
  }

  private async validateMaterialIds(materialIds: number[]): Promise<number[]> {
    const uniqueIds = Array.from(new Set(materialIds));
    if (uniqueIds.length === 0) return uniqueIds;
    const materials = await this.materialRepo.findBy({ id: In(uniqueIds) });
    if (materials.length !== uniqueIds.length) {
      const foundIds = materials.map((m) => m.id);
      const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(`素材ID不存在: ${missingIds.join(', ')}`);
    }
    return uniqueIds;
  }

  async create(data: Partial<Annotation>, userId: number) {
    const materialIds = data.materialIds ? await this.validateMaterialIds(data.materialIds) : [];
    const item = this.repo.create({ ...data, materialIds });
    const saved = await this.repo.save(item);
    await this.createVersion(saved, VersionAction.CREATE, userId);
    return saved;
  }

  async findAll(includeDeleted = false) {
    const query = this.repo.createQueryBuilder('annotation')
      .orderBy('annotation.createdAt', 'DESC');
    return query.getMany();
  }

  async findByScene(sceneNumber: number) {
    return this.repo.find({ where: { sceneNumber }, order: { createdAt: 'DESC' } });
  }

  async findGroupedByScene(searchQuery?: string) {
    const all = await this.repo.find({ order: { sceneNumber: 'ASC', createdAt: 'DESC' } });

    const filtered = searchQuery && searchQuery.trim()
      ? this.searchInScript(searchQuery.trim(), all)
      : all.map((a) => ({ ...a, highlights: [] as any[] }));

    const grouped: Record<string, any[]> = {};
    const noSceneKey = '__nosence__';

    for (const a of filtered) {
      const key = a.sceneNumber != null ? String(a.sceneNumber) : noSceneKey;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    }

    const result = Object.entries(grouped)
      .map(([key, items]) => ({
        sceneNumber: key === noSceneKey ? null : Number(key),
        sceneLabel: key === noSceneKey ? '未指定场次' : `第${key}场`,
        count: items.length,
        annotations: items,
      }))
      .sort((a, b) => {
        if (a.sceneNumber == null) return 1;
        if (b.sceneNumber == null) return -1;
        return a.sceneNumber - b.sceneNumber;
      });

    return {
      groups: result,
      totalCount: filtered.length,
      sceneCount: result.length,
    };
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async getVersions(annotationId: number) {
    return this.versionRepo.find({
      where: { annotationId },
      order: { createdAt: 'DESC' },
    });
  }

  async getVersion(versionId: number) {
    return this.versionRepo.findOne({ where: { id: versionId } });
  }

  async update(id: number, data: Partial<Annotation>, userId: number, userRole: UserRole) {
    const annotation = await this.repo.findOne({ where: { id } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }
    if (!this.canModify(annotation, userId, userRole)) {
      throw new ForbiddenException('无权修改此批注');
    }

    let materialIds = annotation.materialIds ?? [];
    if (data.materialIds !== undefined) {
      materialIds = await this.validateMaterialIds(data.materialIds);
    }

    await this.createVersion(annotation, VersionAction.UPDATE, userId);
    await this.repo.update(id, { ...data, materialIds });
    return this.repo.findOne({ where: { id } });
  }

  async restoreToVersion(annotationId: number, versionId: number, userId: number, userRole: UserRole) {
    const annotation = await this.repo.findOne({ where: { id: annotationId } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }
    if (!this.canModify(annotation, userId, userRole)) {
      throw new ForbiddenException('无权恢复此批注');
    }

    const version = await this.versionRepo.findOne({ where: { id: versionId, annotationId } });
    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    await this.createVersion(annotation, VersionAction.RESTORE, userId);

    await this.repo.update(annotationId, {
      scriptContent: version.scriptContent,
      note: version.note,
      startOffset: version.startOffset,
      endOffset: version.endOffset,
      tag: version.tag,
      sceneNumber: version.sceneNumber,
    });

    return this.repo.findOne({ where: { id: annotationId } });
  }

  async remove(id: number, userId: number, userRole: UserRole) {
    const annotation = await this.repo.findOne({ where: { id } });
    if (!annotation) {
      throw new NotFoundException('批注不存在');
    }
    if (!this.canModify(annotation, userId, userRole)) {
      throw new ForbiddenException('无权删除此批注');
    }

    await this.createVersion(annotation, VersionAction.DELETE, userId);
    return this.repo.delete(id);
  }

  searchInScript(query: string, annotations: Annotation[]) {
    const lowerQuery = query.toLowerCase();
    return annotations
      .filter((a) => a.scriptContent.toLowerCase().includes(lowerQuery) || a.note?.toLowerCase().includes(lowerQuery))
      .map((a) => {
        const highlights: { field: string; start: number; end: number }[] = [];

        const contentLower = a.scriptContent.toLowerCase();
        let idx = contentLower.indexOf(lowerQuery);
        while (idx !== -1) {
          highlights.push({ field: 'scriptContent', start: idx, end: idx + query.length });
          idx = contentLower.indexOf(lowerQuery, idx + 1);
        }

        if (a.note) {
          const noteLower = a.note.toLowerCase();
          let nidx = noteLower.indexOf(lowerQuery);
          while (nidx !== -1) {
            highlights.push({ field: 'note', start: nidx, end: nidx + query.length });
            nidx = noteLower.indexOf(lowerQuery, nidx + 1);
          }
        }

        return { ...a, highlights };
      });
  }
}
