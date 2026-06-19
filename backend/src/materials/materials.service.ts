import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material, Rehearsal, Annotation, AuditAction, AuditModule } from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { extname, join } from 'path';
import { unlinkSync, existsSync } from 'fs';

export interface MaterialReference {
  type: 'rehearsal' | 'annotation';
  id: number;
  title: string;
  detail?: string;
}

export interface DuplicateCheckResult {
  exists: boolean;
  materials: Partial<Material>[];
}

function buildVersionedName(baseName: string, version: number): string {
  if (version <= 1) return baseName;
  const ext = extname(baseName);
  const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;
  return `${nameWithoutExt}_v${version}${ext}`;
}

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private repo: Repository<Material>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    private auditLogsService: AuditLogsService,
  ) {}

  async checkDuplicate(filename: string): Promise<DuplicateCheckResult> {
    let materials = await this.repo
      .createQueryBuilder('m')
      .where('m.baseName = :baseName', { baseName: filename })
      .orderBy('m.version', 'ASC')
      .getMany();

    if (materials.length === 0) {
      materials = await this.repo
        .createQueryBuilder('m')
        .where('m.baseName IS NULL AND m.originalName = :originalName', { originalName: filename })
        .orderBy('m.id', 'ASC')
        .getMany();

      if (materials.length > 0) {
        for (const m of materials) {
          m.baseName = m.originalName;
          if (!m.version) m.version = 1;
          await this.repo.save(m);
        }
      }
    }

    if (materials.length === 0) {
      return { exists: false, materials: [] };
    }

    return {
      exists: true,
      materials: materials.map((m) => ({
        id: m.id,
        originalName: m.originalName,
        version: m.version,
        baseName: m.baseName,
        size: m.size,
        mimeType: m.mimeType,
        createdAt: m.createdAt,
        storedName: m.storedName,
      })),
    };
  }

  async create(
    data: Partial<Material>,
    operatorId?: number,
    operatorName?: string,
    onDuplicate?: 'new_version' | 'overwrite',
    overwriteTargetId?: number,
    uploadDir?: string,
  ) {
    if (!data.baseName) {
      data.baseName = data.originalName;
    }

    if (onDuplicate === 'overwrite' && overwriteTargetId) {
      return this.overwriteMaterial(overwriteTargetId, data, operatorId, operatorName, uploadDir);
    }

    if (onDuplicate === 'new_version') {
      return this.createNewVersion(data, operatorId, operatorName);
    }

    const item = this.repo.create(data);
    if (!item.categories || item.categories.length === 0) {
      item.categories = item.category ? [item.category] : ['general'];
    }
    if (!item.tags) item.tags = [];
    if (!item.downloadRoles) item.downloadRoles = [];
    if (!item.version) item.version = 1;
    if (!item.baseName) item.baseName = item.originalName;

    const saved = await this.repo.save(item);

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.CREATE_MATERIAL,
        module: AuditModule.MATERIAL,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'material',
        detail: `上传素材「${saved.originalName}」`,
        metadata: {
          originalName: saved.originalName,
          size: saved.size,
          mimeType: saved.mimeType,
          categories: saved.categories,
          version: saved.version,
        },
      });
    }

    return saved;
  }

  private async createNewVersion(
    data: Partial<Material>,
    operatorId?: number,
    operatorName?: string,
  ) {
    const existing = await this.repo
      .createQueryBuilder('m')
      .where('m.baseName = :baseName', { baseName: data.baseName })
      .orderBy('m.version', 'DESC')
      .getOne();

    const baseName = data.baseName || data.originalName || '';
    const newVersion = existing ? existing.version + 1 : 1;
    const versionedName = buildVersionedName(baseName, newVersion);

    const item = this.repo.create({
      ...data,
      originalName: versionedName,
      version: newVersion,
    });
    if (!item.categories || item.categories.length === 0) {
      item.categories = item.category ? [item.category] : ['general'];
    }
    if (!item.tags) item.tags = [];
    if (!item.downloadRoles) item.downloadRoles = [];

    const saved = await this.repo.save(item);

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.CREATE_MATERIAL,
        module: AuditModule.MATERIAL,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'material',
        detail: `上传素材新版本「${saved.originalName}」(v${saved.version})`,
        metadata: {
          originalName: saved.originalName,
          baseName: saved.baseName,
          size: saved.size,
          version: saved.version,
        },
      });
    }

    return saved;
  }

  private async overwriteMaterial(
    targetId: number,
    data: Partial<Material>,
    operatorId?: number,
    operatorName?: string,
    uploadDir?: string,
  ) {
    const existing = await this.repo.findOne({ where: { id: targetId } });
    if (!existing) {
      throw new HttpException('目标素材不存在', HttpStatus.NOT_FOUND);
    }

    const oldStoredName = existing.storedName;

    if (uploadDir && oldStoredName) {
      try {
        const oldPath = join(uploadDir, oldStoredName);
        if (existsSync(oldPath)) {
          unlinkSync(oldPath);
        }
      } catch {}
    }

    existing.storedName = data.storedName!;
    existing.size = data.size!;
    existing.mimeType = data.mimeType!;
    if (data.description !== undefined) existing.description = data.description;
    if (data.categories) existing.categories = data.categories;
    if (data.tags) existing.tags = data.tags;
    if (data.downloadRoles) existing.downloadRoles = data.downloadRoles;

    const saved = await this.repo.save(existing);

    if (operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.UPDATE_MATERIAL,
        module: AuditModule.MATERIAL,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'material',
        detail: `覆盖素材「${saved.originalName}」(v${saved.version})`,
        metadata: {
          originalName: saved.originalName,
          baseName: saved.baseName,
          size: saved.size,
          version: saved.version,
          oldStoredName,
          newStoredName: saved.storedName,
        },
      });
    }

    return saved;
  }

  async findAll(params?: { categories?: string; tags?: string; keyword?: string }) {
    let qb = this.repo.createQueryBuilder('m').orderBy('m.createdAt', 'DESC');

    if (params?.categories) {
      const cats = params.categories.split(',').map((c) => c.trim()).filter(Boolean);
      if (cats.length > 0) {
        const conditions = cats.map((_, i) => `m.categories LIKE :cat${i}`).join(' OR ');
        const catParams: Record<string, string> = {};
        cats.forEach((c, i) => { catParams[`cat${i}`] = `%"${c}"%`; });
        qb = qb.andWhere(`(${conditions})`, catParams);
      }
    }

    if (params?.tags) {
      const tagList = params.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const conditions = tagList.map((_, i) => `m.tags LIKE :tag${i}`).join(' OR ');
        const tagParams: Record<string, string> = {};
        tagList.forEach((t, i) => { tagParams[`tag${i}`] = `%"${t}"%`; });
        qb = qb.andWhere(`(${conditions})`, tagParams);
      }
    }

    if (params?.keyword) {
      qb = qb.andWhere(
        '(m.originalName LIKE :kw OR m.description LIKE :kw)',
        { kw: `%${params.keyword}%` },
      );
    }

    return qb.getMany();
  }

  async findByCategory(category: string) {
    return this.repo
      .createQueryBuilder('m')
      .where('m.categories LIKE :cat', { cat: `%"${category}"%` })
      .orWhere('m.category = :category', { category })
      .orderBy('m.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async findOneWithReferences(id: number) {
    const material = await this.repo.findOne({ where: { id } });
    if (!material) return null;

    const references = await this.getReferences(id);
    return { ...material, references };
  }

  async getReferences(materialId: number): Promise<MaterialReference[]> {
    const references: MaterialReference[] = [];

    const rehearsals = await this.rehearsalRepo.find();
    for (const r of rehearsals) {
      if (r.materialIds && Array.isArray(r.materialIds) && r.materialIds.includes(materialId)) {
        references.push({
          type: 'rehearsal',
          id: r.id,
          title: r.title,
          detail: `${r.startTime ? new Date(r.startTime).toLocaleString('zh-CN') : ''}${r.location ? ' · ' + r.location : ''}`,
        });
      }
    }

    const annotations = await this.annotationRepo.find();
    for (const a of annotations) {
      if (a.materialIds && Array.isArray(a.materialIds) && a.materialIds.includes(materialId)) {
        references.push({
          type: 'annotation',
          id: a.id,
          title: a.scriptContent ? a.scriptContent.substring(0, 50) + (a.scriptContent.length > 50 ? '...' : '') : `批注#${a.id}`,
          detail: a.note || (a.sceneNumber ? `第${a.sceneNumber}场` : undefined),
        });
      }
    }

    return references;
  }

  async getReferenceCount(materialId: number): Promise<{ rehearsals: number; annotations: number; total: number }> {
    const rehearsals = await this.rehearsalRepo.find();
    const rehearsalCount = rehearsals.filter(
      (r) => r.materialIds && Array.isArray(r.materialIds) && r.materialIds.includes(materialId),
    ).length;

    const annotations = await this.annotationRepo.find();
    const annotationCount = annotations.filter(
      (a) => a.materialIds && Array.isArray(a.materialIds) && a.materialIds.includes(materialId),
    ).length;

    return { rehearsals: rehearsalCount, annotations: annotationCount, total: rehearsalCount + annotationCount };
  }

  async canDownload(materialId: number, userRole: string): Promise<boolean> {
    const material = await this.findOne(materialId);
    if (!material) return false;
    if (!material.downloadRoles || material.downloadRoles.length === 0) return true;
    return material.downloadRoles.includes(userRole);
  }

  async update(id: number, data: Partial<Material>, operatorId?: number, operatorName?: string) {
    const oldMaterial = await this.repo.findOne({ where: { id } });
    await this.repo.update(id, data);
    const updated = await this.findOne(id);

    if (oldMaterial && operatorId !== undefined) {
      const changes: string[] = [];
      if (data.categories) {
        changes.push(`分类变更`);
      }
      if (data.tags) {
        changes.push(`标签变更`);
      }
      if (data.description !== undefined && data.description !== oldMaterial.description) {
        changes.push(`描述变更`);
      }
      if (data.downloadRoles) {
        changes.push(`下载权限变更`);
      }

      await this.auditLogsService.log({
        action: AuditAction.UPDATE_MATERIAL,
        module: AuditModule.MATERIAL,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'material',
        detail: changes.length > 0
          ? `更新素材「${oldMaterial.originalName}」: ${changes.join('; ')}`
          : `更新素材「${oldMaterial.originalName}」`,
        metadata: { old: oldMaterial, new: data },
      });
    }

    return updated;
  }

  async remove(id: number, operatorId?: number, operatorName?: string) {
    const refCount = await this.getReferenceCount(id);
    if (refCount.total > 0) {
      throw new HttpException(
        `该素材正在被 ${refCount.rehearsals} 个排练和 ${refCount.annotations} 个批注引用，无法删除`,
        HttpStatus.CONFLICT,
      );
    }

    const material = await this.repo.findOne({ where: { id } });
    if (material && operatorId !== undefined) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_MATERIAL,
        module: AuditModule.MATERIAL,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'material',
        detail: `删除素材「${material.originalName}」`,
        metadata: {
          originalName: material.originalName,
          size: material.size,
          categories: material.categories,
        },
      });
    }

    return this.repo.delete(id);
  }

  async getAllCategories(): Promise<string[]> {
    const materials = await this.repo.find();
    const catSet = new Set<string>();
    materials.forEach((m) => {
      if (m.categories) m.categories.forEach((c) => catSet.add(c));
      if (m.category) catSet.add(m.category);
    });
    return Array.from(catSet).sort();
  }

  async getAllTags(): Promise<string[]> {
    const materials = await this.repo.find();
    const tagSet = new Set<string>();
    materials.forEach((m) => {
      if (m.tags) m.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }

  async enrichWithReferenceCounts(materials: Material[]) {
    const result: any[] = [];
    for (const m of materials) {
      const refCount = await this.getReferenceCount(m.id);
      result.push({ ...m, referenceCount: refCount });
    }
    return result;
  }
}
