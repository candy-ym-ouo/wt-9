import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation, AnnotationVersion, VersionAction, UserRole } from '../entities';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private repo: Repository<Annotation>,
    @InjectRepository(AnnotationVersion)
    private versionRepo: Repository<AnnotationVersion>,
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

  async create(data: Partial<Annotation>, userId: number) {
    const item = this.repo.create(data);
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

    await this.createVersion(annotation, VersionAction.UPDATE, userId);
    await this.repo.update(id, data);
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
