import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import {
  Script,
  ScriptChapter,
  ScriptScene,
  ScriptVersion,
  ScriptStatus,
  ScriptFormat,
  ScriptVersionAction,
  SceneLocationType,
  SceneTimeOfDay,
  AuditAction,
  AuditModule,
  Annotation,
  UserRole,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface ParseResult {
  chapters: Array<{
    chapterNumber: number;
    title: string;
    summary?: string;
    content: string;
    scenes: Array<{
      sceneNumber: number;
      sceneKey?: string;
      location?: string;
      locationType?: SceneLocationType;
      timeOfDay?: SceneTimeOfDay;
      summary?: string;
      content: string;
      characterNames?: string[];
      dialogueCount?: number;
      wordCount?: number;
      startOffset: number;
      endOffset: number;
    }>;
    wordCount: number;
    startOffset: number;
    endOffset: number;
  }>;
  characterNames: string[];
  totalWordCount: number;
  totalSceneCount: number;
  totalChapterCount: number;
}

export interface SearchHighlight {
  field: string;
  start: number;
  end: number;
  text?: string;
}

export interface ScriptSearchResult {
  id: number;
  type: 'script' | 'chapter' | 'scene';
  title: string;
  description?: string;
  scriptId?: number;
  chapterId?: number;
  sceneId?: number;
  sceneNumber?: number;
  chapterNumber?: number;
  highlights: SearchHighlight[];
  score: number;
}

@Injectable()
export class ScriptsService {
  constructor(
    @InjectRepository(Script)
    private scriptRepo: Repository<Script>,
    @InjectRepository(ScriptChapter)
    private chapterRepo: Repository<ScriptChapter>,
    @InjectRepository(ScriptScene)
    private sceneRepo: Repository<ScriptScene>,
    @InjectRepository(ScriptVersion)
    private versionRepo: Repository<ScriptVersion>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    data: Partial<Script> & { chapters?: any[]; scenes?: any[] },
    operatorId: number,
    operatorName: string,
  ) {
    const scriptData: Partial<Script> = {
      ...data,
      createdBy: operatorId,
      updatedBy: operatorId,
      currentVersion: 1,
      tags: data.tags || [],
      characterNames: data.characterNames || [],
    };

    const script = this.scriptRepo.create(scriptData);
    const savedScript = await this.scriptRepo.save(script);

    if (data.chapters && data.chapters.length > 0) {
      await this.saveChapters(savedScript.id, data.chapters, operatorId);
    }
    if (data.scenes && data.scenes.length > 0) {
      await this.saveScenes(savedScript.id, data.scenes, operatorId);
    }

    await this.createVersion(savedScript, ScriptVersionAction.CREATE, operatorId, operatorName, '初始创建');

    await this.auditLogsService.log({
      action: AuditAction.CREATE_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: savedScript.id,
      targetType: 'script',
      detail: `创建剧本「${savedScript.title}」`,
      metadata: { title: savedScript.title, author: savedScript.author },
    });

    return this.findOne(savedScript.id);
  }

  async uploadScript(
    data: {
      title: string;
      content: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      format?: ScriptFormat;
      author?: string;
      description?: string;
      autoParse?: boolean;
    },
    operatorId: number,
    operatorName: string,
  ) {
    const script: Partial<Script> = {
      title: data.title,
      rawContent: data.content,
      parsedContent: data.content,
      author: data.author,
      description: data.description,
      sourceFileName: data.fileName,
      sourceFileMime: data.mimeType,
      sourceFileSize: data.fileSize,
      format: data.format || ScriptFormat.PLAIN_TEXT,
      status: ScriptStatus.DRAFT,
      wordCount: this.countWords(data.content),
      characterCount: data.content.length,
      createdBy: operatorId,
      updatedBy: operatorId,
      currentVersion: 1,
      tags: [],
      characterNames: [],
    };

    const saved = await this.scriptRepo.save(this.scriptRepo.create(script));

    if (data.autoParse !== false) {
      const parseResult = this.parseContent(data.content);
      await this.saveChapters(saved.id, parseResult.chapters, operatorId);
      await this.saveScenesFromParseResult(saved.id, parseResult.chapters, operatorId);

      await this.scriptRepo.update(saved.id, {
        chapterCount: parseResult.totalChapterCount,
        sceneCount: parseResult.totalSceneCount,
        wordCount: parseResult.totalWordCount,
        characterNames: parseResult.characterNames,
      });
    }

    await this.createVersion(saved, ScriptVersionAction.UPLOAD, operatorId, operatorName, '上传剧本');

    await this.auditLogsService.log({
      action: AuditAction.UPLOAD_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'script',
      detail: `上传剧本「${saved.title}」`,
      metadata: {
        title: saved.title,
        fileName: data.fileName,
        fileSize: data.fileSize,
        format: data.format,
      },
    });

    return this.findOne(saved.id);
  }

  async reparseScript(scriptId: number, operatorId: number, operatorName: string) {
    const script = await this.scriptRepo.findOne({ where: { id: scriptId } });
    if (!script) {
      throw new NotFoundException('剧本不存在');
    }

    const oldChapters = await this.chapterRepo.find({ where: { scriptId } });
    const oldScenes = await this.sceneRepo.find({ where: { scriptId } });

    await this.chapterRepo.delete({ scriptId });
    await this.sceneRepo.delete({ scriptId });

    const parseResult = this.parseContent(script.rawContent);
    await this.saveChapters(scriptId, parseResult.chapters, operatorId);
    await this.saveScenesFromParseResult(scriptId, parseResult.chapters, operatorId);

    await this.scriptRepo.update(scriptId, {
      chapterCount: parseResult.totalChapterCount,
      sceneCount: parseResult.totalSceneCount,
      wordCount: parseResult.totalWordCount,
      characterNames: parseResult.characterNames,
      updatedBy: operatorId,
    });

    const updated = await this.findOne(scriptId);
    await this.createVersion(script, ScriptVersionAction.UPDATE, operatorId, operatorName, '重新解析剧本结构');

    await this.auditLogsService.log({
      action: AuditAction.REPARSE_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: scriptId,
      targetType: 'script',
      detail: `重新解析剧本「${script.title}」`,
      metadata: {
        oldChapterCount: oldChapters.length,
        newChapterCount: parseResult.totalChapterCount,
        oldSceneCount: oldScenes.length,
        newSceneCount: parseResult.totalSceneCount,
      },
    });

    return updated;
  }

  async findAll(params?: { keyword?: string; status?: ScriptStatus; tags?: string; author?: string }) {
    let qb = this.scriptRepo.createQueryBuilder('s').orderBy('s.updatedAt', 'DESC');

    if (params?.keyword) {
      qb = qb.andWhere(
        '(s.title LIKE :kw OR s.author LIKE :kw OR s.description LIKE :kw OR s.rawContent LIKE :kw)',
        { kw: `%${params.keyword}%` },
      );
    }
    if (params?.status) {
      qb = qb.andWhere('s.status = :status', { status: params.status });
    }
    if (params?.author) {
      qb = qb.andWhere('s.author LIKE :author', { author: `%${params.author}%` });
    }
    if (params?.tags) {
      const tagList = params.tags.split(',').map((t) => t.trim()).filter(Boolean);
      tagList.forEach((tag, i) => {
        qb = qb.andWhere(`s.tags LIKE :tag${i}`, { [`tag${i}`]: `%"${tag}"%` });
      });
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const script = await this.scriptRepo.findOne({ where: { id } });
    if (!script) return null;

    const chapters = await this.chapterRepo.find({
      where: { scriptId: id },
      order: { sortOrder: 'ASC', chapterNumber: 'ASC' },
    });
    const scenes = await this.sceneRepo.find({
      where: { scriptId: id },
      order: { sortOrder: 'ASC', sceneNumber: 'ASC' },
    });
    const annotations = await this.annotationRepo.find({
      where: { scriptId: id },
      order: { createdAt: 'DESC' },
    });

    const chaptersWithScenes = chapters.map((chapter) => ({
      ...chapter,
      scenes: scenes.filter((s) => s.chapterId === chapter.id),
      annotationCount: annotations.filter((a) => a.chapterId === chapter.id).length,
    }));

    return {
      ...script,
      chapters: chaptersWithScenes,
      scenes,
      annotations,
      annotationCount: annotations.length,
    };
  }

  async findOneWithStructure(id: number) {
    const script = await this.findOne(id);
    if (!script) return null;

    return script;
  }

  async getChapter(scriptId: number, chapterId: number) {
    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId, scriptId } });
    if (!chapter) return null;

    const scenes = await this.sceneRepo.find({
      where: { chapterId, scriptId },
      order: { sortOrder: 'ASC', sceneNumber: 'ASC' },
    });
    const annotations = await this.annotationRepo.find({
      where: { chapterId },
      order: { createdAt: 'DESC' },
    });

    return { ...chapter, scenes, annotations };
  }

  async getScene(scriptId: number, sceneId: number) {
    const scene = await this.sceneRepo.findOne({ where: { id: sceneId, scriptId } });
    if (!scene) return null;

    const annotations = await this.annotationRepo.find({
      where: { sceneId },
      order: { createdAt: 'DESC' },
    });

    return { ...scene, annotations };
  }

  async update(
    id: number,
    data: Partial<Script>,
    operatorId: number,
    operatorName: string,
    changeNote?: string,
  ) {
    const script = await this.scriptRepo.findOne({ where: { id } });
    if (!script) {
      throw new NotFoundException('剧本不存在');
    }

    const oldVersion = script.currentVersion || 1;
    await this.scriptRepo.update(id, {
      ...data,
      updatedBy: operatorId,
      currentVersion: oldVersion + 1,
    });

    await this.createVersion(script, ScriptVersionAction.UPDATE, operatorId, operatorName, changeNote || '更新剧本信息');

    const changes: string[] = [];
    if (data.title && data.title !== script.title) {
      changes.push(`标题: ${script.title} → ${data.title}`);
    }
    if (data.author !== undefined && data.author !== script.author) {
      changes.push(`作者变更`);
    }
    if (data.status && data.status !== script.status) {
      changes.push(`状态: ${script.status} → ${data.status}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'script',
      detail: changes.length > 0
        ? `更新剧本「${script.title}」: ${changes.join('; ')}`
        : `更新剧本「${script.title}」`,
      metadata: { old: script, new: data },
    });

    return this.findOne(id);
  }

  async updateChapter(
    scriptId: number,
    chapterId: number,
    data: Partial<ScriptChapter>,
    operatorId: number,
    operatorName: string,
  ) {
    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId, scriptId } });
    if (!chapter) {
      throw new NotFoundException('章节不存在');
    }

    await this.chapterRepo.update(chapterId, data);

    const script = await this.scriptRepo.findOne({ where: { id: scriptId } });
    await this.auditLogsService.log({
      action: AuditAction.UPDATE_SCRIPT_CHAPTER,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: chapterId,
      targetType: 'script_chapter',
      detail: `更新剧本「${script?.title}」章节${chapter.chapterNumber}`,
      metadata: { scriptId, chapterId, old: chapter, new: data },
    });

    return this.chapterRepo.findOne({ where: { id: chapterId } });
  }

  async updateScene(
    scriptId: number,
    sceneId: number,
    data: Partial<ScriptScene>,
    operatorId: number,
    operatorName: string,
  ) {
    const scene = await this.sceneRepo.findOne({ where: { id: sceneId, scriptId } });
    if (!scene) {
      throw new NotFoundException('场次不存在');
    }

    await this.sceneRepo.update(sceneId, data);

    const script = await this.scriptRepo.findOne({ where: { id: scriptId } });
    await this.auditLogsService.log({
      action: AuditAction.UPDATE_SCRIPT_SCENE,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: sceneId,
      targetType: 'script_scene',
      detail: `更新剧本「${script?.title}」场次${scene.sceneNumber}`,
      metadata: { scriptId, sceneId, old: scene, new: data },
    });

    return this.sceneRepo.findOne({ where: { id: sceneId } });
  }

  async publish(id: number, operatorId: number, operatorName: string) {
    const script = await this.scriptRepo.findOne({ where: { id } });
    if (!script) {
      throw new NotFoundException('剧本不存在');
    }

    await this.scriptRepo.update(id, { status: ScriptStatus.PUBLISHED, updatedBy: operatorId });
    await this.createVersion(script, ScriptVersionAction.PUBLISH, operatorId, operatorName, '发布剧本');

    await this.auditLogsService.log({
      action: AuditAction.PUBLISH_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'script',
      detail: `发布剧本「${script.title}」`,
      metadata: { title: script.title },
    });

    return this.findOne(id);
  }

  async archive(id: number, operatorId: number, operatorName: string) {
    const script = await this.scriptRepo.findOne({ where: { id } });
    if (!script) {
      throw new NotFoundException('剧本不存在');
    }

    await this.scriptRepo.update(id, { status: ScriptStatus.ARCHIVED, updatedBy: operatorId });
    await this.createVersion(script, ScriptVersionAction.ARCHIVE, operatorId, operatorName, '归档剧本');

    await this.auditLogsService.log({
      action: AuditAction.ARCHIVE_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'script',
      detail: `归档剧本「${script.title}」`,
      metadata: { title: script.title },
    });

    return this.findOne(id);
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const script = await this.scriptRepo.findOne({ where: { id } });
    if (!script) {
      throw new NotFoundException('剧本不存在');
    }

    await this.annotationRepo.delete({ scriptId: id });
    await this.chapterRepo.delete({ scriptId: id });
    await this.sceneRepo.delete({ scriptId: id });
    await this.versionRepo.delete({ scriptId: id });
    await this.scriptRepo.delete(id);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_SCRIPT,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'script',
      detail: `删除剧本「${script.title}」`,
      metadata: { title: script.title, author: script.author },
    });

    return { success: true };
  }

  async getVersions(scriptId: number) {
    return this.versionRepo.find({
      where: { scriptId },
      order: { versionNumber: 'DESC', createdAt: 'DESC' },
    });
  }

  async getVersion(scriptId: number, versionId: number) {
    return this.versionRepo.findOne({ where: { id: versionId, scriptId } });
  }

  async restoreToVersion(
    scriptId: number,
    versionId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const script = await this.scriptRepo.findOne({ where: { id: scriptId } });
    if (!script) {
      throw new NotFoundException('剧本不存在');
    }

    const version = await this.versionRepo.findOne({ where: { id: versionId, scriptId } });
    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    await this.chapterRepo.delete({ scriptId });
    await this.sceneRepo.delete({ scriptId });

    if (version.chaptersSnapshot && Array.isArray(version.chaptersSnapshot)) {
      await this.saveChapters(scriptId, version.chaptersSnapshot, operatorId);
    }
    if (version.scenesSnapshot && Array.isArray(version.scenesSnapshot)) {
      const scenes = version.scenesSnapshot.map((s: any) => ({ ...s, scriptId }));
      await this.saveScenes(scriptId, scenes, operatorId);
    }

    await this.scriptRepo.update(scriptId, {
      rawContent: version.rawContent || script.rawContent,
      parsedContent: version.parsedContent || script.parsedContent,
      title: version.title || script.title,
      currentVersion: (script.currentVersion || 1) + 1,
      updatedBy: operatorId,
    });

    await this.createVersion(script, ScriptVersionAction.RESTORE, operatorId, operatorName, `恢复到版本 v${version.versionNumber}`);

    await this.auditLogsService.log({
      action: AuditAction.RESTORE_SCRIPT_VERSION,
      module: AuditModule.SCRIPT,
      operatorId,
      operatorName,
      targetId: scriptId,
      targetType: 'script',
      detail: `恢复剧本「${script.title}」到版本 v${version.versionNumber}`,
      metadata: { scriptId, versionId, versionNumber: version.versionNumber },
    });

    return this.findOne(scriptId);
  }

  async getSceneAnnotations(scriptId: number, sceneId: number) {
    return this.annotationRepo.find({
      where: { scriptId, sceneId },
      order: { createdAt: 'DESC' },
    });
  }

  async getChapterAnnotations(scriptId: number, chapterId: number) {
    return this.annotationRepo.find({
      where: { scriptId, chapterId },
      order: { createdAt: 'DESC' },
    });
  }

  async getScriptAnnotations(scriptId: number) {
    return this.annotationRepo.find({
      where: { scriptId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAnnotationsGroupedByScene(scriptId: number) {
    const annotations = await this.annotationRepo.find({
      where: { scriptId },
      order: { createdAt: 'DESC' },
    });
    const scenes = await this.sceneRepo.find({ where: { scriptId }, order: { sceneNumber: 'ASC' } });

    const groups: Record<string, any> = {};

    scenes.forEach((scene) => {
      groups[`scene_${scene.id}`] = {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        location: scene.location,
        sceneKey: scene.sceneKey,
        annotations: [],
      };
    });

    groups['__unassigned__'] = {
      sceneId: null,
      sceneNumber: null,
      location: '未分配场次',
      sceneKey: null,
      annotations: [],
    };

    annotations.forEach((a) => {
      const key = a.sceneId ? `scene_${a.sceneId}` : '__unassigned__';
      if (!groups[key]) {
        groups[key] = {
          sceneId: a.sceneId,
          annotations: [],
        };
      }
      groups[key].annotations.push(a);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.sceneNumber == null) return 1;
      if (b.sceneNumber == null) return -1;
      return a.sceneNumber - b.sceneNumber;
    });
  }

  searchInScript(scriptId: number, query: string): ScriptSearchResult[] {
    const results: ScriptSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    return results;
  }

  async fullTextSearch(query: string, scriptId?: number): Promise<ScriptSearchResult[]> {
    const results: ScriptSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    const scriptWhere: any = scriptId ? { id: scriptId } : {};
    const scripts = await this.scriptRepo.find({ where: scriptWhere });

    scripts.forEach((script) => {
      const titleLower = script.title.toLowerCase();
      const descLower = (script.description || '').toLowerCase();
      const contentLower = script.rawContent.toLowerCase();

      let score = 0;
      const highlights: SearchHighlight[] = [];

      if (titleLower === lowerQuery) {
        score += 100;
        highlights.push({ field: 'title', start: 0, end: script.title.length });
      } else if (titleLower.includes(lowerQuery)) {
        score += 60;
        let idx = titleLower.indexOf(lowerQuery);
        while (idx !== -1) {
          highlights.push({ field: 'title', start: idx, end: idx + query.length });
          idx = titleLower.indexOf(lowerQuery, idx + 1);
        }
      }

      if (descLower.includes(lowerQuery)) {
        score += 30;
        let idx = descLower.indexOf(lowerQuery);
        while (idx !== -1) {
          highlights.push({ field: 'description', start: idx, end: idx + query.length });
          idx = descLower.indexOf(lowerQuery, idx + 1);
        }
      }

      if (contentLower.includes(lowerQuery)) {
        score += 20;
        let idx = contentLower.indexOf(lowerQuery);
        let count = 0;
        while (idx !== -1 && count < 5) {
          highlights.push({
            field: 'rawContent',
            start: idx,
            end: idx + query.length,
            text: script.rawContent.substring(Math.max(0, idx - 20), Math.min(script.rawContent.length, idx + query.length + 20)),
          });
          idx = contentLower.indexOf(lowerQuery, idx + 1);
          count++;
        }
      }

      if (score > 0) {
        results.push({
          id: script.id,
          type: 'script',
          title: script.title,
          description: script.description || undefined,
          highlights,
          score,
        });
      }
    });

    const chapterWhere: any = scriptId ? { scriptId } : {};
    const chapters = await this.chapterRepo.find({ where: chapterWhere });

    chapters.forEach((chapter) => {
      const titleLower = (chapter.title || '').toLowerCase();
      const contentLower = (chapter.content || '').toLowerCase();

      let score = 0;
      const highlights: SearchHighlight[] = [];

      if (titleLower.includes(lowerQuery)) {
        score += 50;
        let idx = titleLower.indexOf(lowerQuery);
        while (idx !== -1) {
          highlights.push({ field: 'title', start: idx, end: idx + query.length });
          idx = titleLower.indexOf(lowerQuery, idx + 1);
        }
      }

      if (contentLower.includes(lowerQuery)) {
        score += 25;
        let idx = contentLower.indexOf(lowerQuery);
        let count = 0;
        while (idx !== -1 && count < 3) {
          highlights.push({
            field: 'content',
            start: idx,
            end: idx + query.length,
            text: (chapter.content || '').substring(Math.max(0, idx - 20), Math.min((chapter.content || '').length, idx + query.length + 20)),
          });
          idx = contentLower.indexOf(lowerQuery, idx + 1);
          count++;
        }
      }

      if (score > 0) {
        results.push({
          id: chapter.id,
          type: 'chapter',
          title: chapter.title || `第${chapter.chapterNumber}章`,
          description: chapter.summary || undefined,
          scriptId: chapter.scriptId,
          chapterId: chapter.id,
          chapterNumber: chapter.chapterNumber,
          highlights,
          score,
        });
      }
    });

    const sceneWhere: any = scriptId ? { scriptId } : {};
    const scenes = await this.sceneRepo.find({ where: sceneWhere });

    scenes.forEach((scene) => {
      const locationLower = (scene.location || '').toLowerCase();
      const contentLower = (scene.content || '').toLowerCase();
      const charNamesLower = (scene.characterNames || []).join(' ').toLowerCase();

      let score = 0;
      const highlights: SearchHighlight[] = [];

      if (locationLower.includes(lowerQuery)) {
        score += 45;
        let idx = locationLower.indexOf(lowerQuery);
        while (idx !== -1) {
          highlights.push({ field: 'location', start: idx, end: idx + query.length });
          idx = locationLower.indexOf(lowerQuery, idx + 1);
        }
      }

      if (charNamesLower.includes(lowerQuery)) {
        score += 35;
        highlights.push({ field: 'characterNames', start: 0, end: query.length });
      }

      if (contentLower.includes(lowerQuery)) {
        score += 25;
        let idx = contentLower.indexOf(lowerQuery);
        let count = 0;
        while (idx !== -1 && count < 3) {
          highlights.push({
            field: 'content',
            start: idx,
            end: idx + query.length,
            text: (scene.content || '').substring(Math.max(0, idx - 20), Math.min((scene.content || '').length, idx + query.length + 20)),
          });
          idx = contentLower.indexOf(lowerQuery, idx + 1);
          count++;
        }
      }

      if (score > 0) {
        results.push({
          id: scene.id,
          type: 'scene',
          title: scene.location || `第${scene.sceneNumber}场`,
          description: scene.summary || undefined,
          scriptId: scene.scriptId,
          chapterId: scene.chapterId,
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          highlights,
          score,
        });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }

  async getAllTags() {
    const scripts = await this.scriptRepo.find({ select: ['tags'] });
    const tagSet = new Set<string>();
    scripts.forEach((s) => {
      if (s.tags) s.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }

  async getAllAuthors() {
    const scripts = await this.scriptRepo.find({ select: ['author'] });
    const authorSet = new Set<string>();
    scripts.forEach((s) => {
      if (s.author) authorSet.add(s.author);
    });
    return Array.from(authorSet).sort();
  }

  async getAllCharacterNames(scriptId?: number) {
    const where: any = scriptId ? { scriptId } : {};
    const scripts = await this.scriptRepo.find({ where, select: ['characterNames'] });
    const charSet = new Set<string>();
    scripts.forEach((s) => {
      if (s.characterNames) s.characterNames.forEach((c) => charSet.add(c));
    });
    return Array.from(charSet).sort();
  }

  private async saveChapters(scriptId: number, chapters: any[], operatorId: number) {
    const entities = chapters.map((c, idx) =>
      this.chapterRepo.create({
        scriptId,
        chapterNumber: c.chapterNumber || idx + 1,
        title: c.title,
        summary: c.summary,
        content: c.content,
        sceneCount: c.scenes?.length || 0,
        wordCount: c.wordCount || this.countWords(c.content || ''),
        startOffset: c.startOffset || 0,
        endOffset: c.endOffset || 0,
        sortOrder: c.sortOrder != null ? c.sortOrder : idx,
        createdBy: operatorId,
      }),
    );
    return this.chapterRepo.save(entities);
  }

  private async saveScenes(scriptId: number, scenes: any[], operatorId: number) {
    const entities = scenes.map((s, idx) =>
      this.sceneRepo.create({
        scriptId,
        chapterId: s.chapterId,
        sceneNumber: s.sceneNumber || idx + 1,
        sceneKey: s.sceneKey,
        location: s.location,
        locationType: s.locationType || SceneLocationType.UNKNOWN,
        timeOfDay: s.timeOfDay || SceneTimeOfDay.UNKNOWN,
        summary: s.summary,
        content: s.content,
        characterNames: s.characterNames || [],
        dialogueCount: s.dialogueCount || 0,
        wordCount: s.wordCount || this.countWords(s.content || ''),
        estimatedDuration: s.estimatedDuration || 0,
        startOffset: s.startOffset || 0,
        endOffset: s.endOffset || 0,
        sortOrder: s.sortOrder != null ? s.sortOrder : idx,
        createdBy: operatorId,
      }),
    );
    return this.sceneRepo.save(entities);
  }

  private async saveScenesFromParseResult(scriptId: number, chapters: any[], operatorId: number) {
    const allScenes: any[] = [];
    const savedChapters = await this.chapterRepo.find({ where: { scriptId } });
    const chapterMap = new Map(savedChapters.map((c) => [c.chapterNumber, c.id]));

    chapters.forEach((chapter) => {
      const chapterId = chapterMap.get(chapter.chapterNumber);
      (chapter.scenes || []).forEach((scene: any) => {
        allScenes.push({
          ...scene,
          chapterId,
        });
      });
    });

    return this.saveScenes(scriptId, allScenes, operatorId);
  }

  private async createVersion(
    script: Script,
    action: ScriptVersionAction,
    actionBy: number,
    actionByName: string,
    changeNote?: string,
  ) {
    const lastVersion = await this.versionRepo.findOne({
      where: { scriptId: script.id },
      order: { versionNumber: 'DESC' },
    });

    const chapters = await this.chapterRepo.find({ where: { scriptId: script.id } });
    const scenes = await this.sceneRepo.find({ where: { scriptId: script.id } });

    const version = this.versionRepo.create({
      scriptId: script.id,
      versionNumber: (lastVersion?.versionNumber || 0) + 1,
      title: script.title,
      changeNote,
      rawContent: script.rawContent,
      parsedContent: script.parsedContent,
      chaptersSnapshot: chapters,
      scenesSnapshot: scenes,
      metadata: {
        status: script.status,
        chapterCount: chapters.length,
        sceneCount: scenes.length,
      },
      action,
      actionBy,
      actionByName,
    });

    return this.versionRepo.save(version);
  }

  private countWords(text: string): number {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  parseContent(content: string): ParseResult {
    const lines = content.split('\n');
    const chapters: ParseResult['chapters'] = [];
    const characterNames = new Set<string>();
    let totalWordCount = 0;
    let totalSceneCount = 0;

    let currentChapter: any = null;
    let currentScene: any = null;
    let globalOffset = 0;
    let chapterOffset = 0;
    let sceneOffset = 0;

    const chapterRegex = /^第([一二三四五六七八九十百千零\d]+)[章节幕集卷]\s*(.*)$/;
    const sceneRegex = /^(\d+)\.\s*(.+)$|^场\s*(\d+)\s*[:：]?\s*(.*)$|^SCENE\s*(\d+)\s*[:：.-]?\s*(.*)$/i;
    const sluglineRegex = /^(INT|EXT|INT\/EXT|INT\.|EXT\.|内景|外景|内外景)\b[.\-\s]+(.+)/i;
    const characterDialogueRegex = /^([\u4e00-\u9fa5A-Za-z]{2,20})\s*[:：]\s*(.+)$/;

    lines.forEach((line, lineIndex) => {
      const lineLen = line.length + 1;
      const chapterMatch = line.match(chapterRegex);
      const sceneMatch = line.match(sceneRegex);
      const sluglineMatch = line.match(sluglineRegex);
      const dialogueMatch = line.match(characterDialogueRegex);

      if (chapterMatch) {
        if (currentScene && currentChapter) {
          currentScene.endOffset = sceneOffset;
          currentScene.wordCount = this.countWords(currentScene.content);
          currentChapter.scenes.push(currentScene);
          currentScene = null;
        }
        if (currentChapter) {
          currentChapter.endOffset = chapterOffset;
          currentChapter.wordCount = this.countWords(currentChapter.content);
          chapters.push(currentChapter);
        }

        const chapterNumber = this.parseChineseNumber(chapterMatch[1]) || chapters.length + 1;
        const title = chapterMatch[2]?.trim() || `第${chapterMatch[1]}章`;

        currentChapter = {
          chapterNumber,
          title,
          content: line + '\n',
          scenes: [],
          wordCount: 0,
          startOffset: globalOffset,
          endOffset: 0,
        };
        chapterOffset = lineLen;
      } else if (sceneMatch || sluglineMatch) {
        if (currentScene && currentChapter) {
          currentScene.endOffset = sceneOffset;
          currentScene.wordCount = this.countWords(currentScene.content);
          currentChapter.scenes.push(currentScene);
        }

        let sceneNumber: number;
        let location: string | undefined;
        let locationType = SceneLocationType.UNKNOWN;
        let timeOfDay = SceneTimeOfDay.UNKNOWN;

        if (sluglineMatch) {
          const typeStr = sluglineMatch[1].toUpperCase();
          if (typeStr.startsWith('INT')) {
            locationType = typeStr.includes('EXT') ? SceneLocationType.INT_EXT : SceneLocationType.INT;
          } else if (typeStr.startsWith('EXT')) {
            locationType = SceneLocationType.EXT;
          }

          const rest = sluglineMatch[2];
          const timeMatch = rest.match(/\s*-\s*(白天|夜晚|黎明|黄昏|晨|夜|日|夜|DAY|NIGHT|DAWN|DUSK)\s*$/i);
          if (timeMatch) {
            location = rest.slice(0, timeMatch.index).trim();
            const timeStr = timeMatch[1].toUpperCase();
            if (timeStr.includes('DAY') || timeStr.includes('日') || timeStr.includes('晨')) {
              timeOfDay = timeStr.includes('DAWN') || timeStr.includes('黎明') ? SceneTimeOfDay.DAWN : SceneTimeOfDay.DAY;
            } else if (timeStr.includes('NIGHT') || timeStr.includes('夜') || timeStr.includes('黄昏') || timeStr.includes('DUSK')) {
              timeOfDay = timeStr.includes('DUSK') || timeStr.includes('黄昏') ? SceneTimeOfDay.DUSK : SceneTimeOfDay.NIGHT;
            }
          } else {
            location = rest.trim();
          }

          sceneNumber = currentChapter ? currentChapter.scenes.length + 1 : 1;
        } else if (sceneMatch) {
          sceneNumber = parseInt(sceneMatch[1] || sceneMatch[3] || sceneMatch[5] || '1', 10);
          location = (sceneMatch[2] || sceneMatch[4] || sceneMatch[6])?.trim();
        } else {
          sceneNumber = currentChapter ? currentChapter.scenes.length + 1 : 1;
        }

        if (!currentChapter) {
          currentChapter = {
            chapterNumber: 1,
            title: '默认章节',
            content: '',
            scenes: [],
            wordCount: 0,
            startOffset: globalOffset,
            endOffset: 0,
          };
        }

        currentScene = {
          sceneNumber,
          sceneKey: location ? `${locationType}_${location}`.toUpperCase() : undefined,
          location,
          locationType,
          timeOfDay,
          content: line + '\n',
          characterNames: [],
          dialogueCount: 0,
          wordCount: 0,
          startOffset: currentChapter ? chapterOffset : globalOffset,
          endOffset: 0,
        };
        sceneOffset = lineLen;
      } else if (dialogueMatch) {
        const charName = dialogueMatch[1].trim();
        if (charName.length <= 20 && !/^[。，、；：！？,.\!?;:\s]+$/.test(charName)) {
          characterNames.add(charName);
          if (currentScene) {
            if (!currentScene.characterNames!.includes(charName)) {
              currentScene.characterNames!.push(charName);
            }
            currentScene.dialogueCount = (currentScene.dialogueCount || 0) + 1;
            currentScene.content += line + '\n';
            sceneOffset += lineLen;
          } else {
            if (currentChapter) {
              currentChapter.content += line + '\n';
              chapterOffset += lineLen;
            }
          }
        } else {
          if (currentScene) {
            currentScene.content += line + '\n';
            sceneOffset += lineLen;
          } else if (currentChapter) {
            currentChapter.content += line + '\n';
            chapterOffset += lineLen;
          }
        }
      } else {
        if (currentScene) {
          currentScene.content += line + '\n';
          sceneOffset += lineLen;
        } else if (currentChapter) {
          currentChapter.content += line + '\n';
          chapterOffset += lineLen;
        }
      }

      globalOffset += lineLen;
    });

    if (currentScene && currentChapter) {
      currentScene.endOffset = sceneOffset;
      currentScene.wordCount = this.countWords(currentScene.content);
      currentChapter.scenes.push(currentScene);
    }
    if (currentChapter) {
      currentChapter.endOffset = chapterOffset;
      currentChapter.wordCount = this.countWords(currentChapter.content);
      chapters.push(currentChapter);
    }

    if (chapters.length === 0) {
      chapters.push({
        chapterNumber: 1,
        title: '全文',
        summary: '',
        content: content,
        scenes: [],
        wordCount: this.countWords(content),
        startOffset: 0,
        endOffset: globalOffset,
      });
    }

    chapters.forEach((c) => {
      totalWordCount += c.wordCount;
      totalSceneCount += c.scenes.length;
    });

    return {
      chapters,
      characterNames: Array.from(characterNames).sort(),
      totalWordCount,
      totalSceneCount,
      totalChapterCount: chapters.length,
    };
  }

  private parseChineseNumber(str: string): number | null {
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }

    const chineseDigits: Record<string, number> = {
      '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
      '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    };
    const chineseUnits: Record<string, number> = {
      '十': 10, '百': 100, '千': 1000,
    };

    let result = 0;
    let current = 0;
    let hasUnit = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (chineseDigits[char] !== undefined) {
        current = chineseDigits[char];
      } else if (chineseUnits[char] !== undefined) {
        const unit = chineseUnits[char];
        if (current === 0 && !hasUnit) current = 1;
        result += current * unit;
        current = 0;
        hasUnit = true;
      }
    }

    result += current;
    return result > 0 ? result : null;
  }
}
