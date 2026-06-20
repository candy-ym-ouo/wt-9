import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  User,
  UserRole,
  CastRole,
  Rehearsal,
  Material,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';

export enum ImportType {
  USERS = 'users',
  ROLES = 'roles',
  REHEARSALS = 'rehearsals',
  MATERIALS = 'materials',
}

export enum OverrideStrategy {
  SKIP = 'skip',
  OVERWRITE = 'overwrite',
  CREATE_NEW = 'create_new',
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

export interface ImportWarning {
  row: number;
  message: string;
}

export interface ImportPreviewResult {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicates: number;
  newRecords: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  preview: {
    willCreate: number;
    willUpdate: number;
    willSkip: number;
  };
}

export interface ImportExecuteResult {
  taskId: string;
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  duration: number;
}

export interface ImportRequest {
  type: ImportType;
  data: any[];
  dramaId?: number;
  strategy: OverrideStrategy;
}

const importResultsStore = new Map<string, ImportExecuteResult>();

@Injectable()
export class DataImportService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => DramasService))
    private dramasService: DramasService,
  ) {}

  async preview(req: ImportRequest, operatorId: number, operatorName: string): Promise<ImportPreviewResult> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    let duplicates = 0;
    let newRecords = 0;

    const { type, data, dramaId, strategy } = req;

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('导入数据不能为空');
    }

    if (data.length > 1000) {
      throw new BadRequestException('单次导入数据不能超过1000条');
    }

    if ([ImportType.ROLES, ImportType.REHEARSALS, ImportType.MATERIALS].includes(type) && !dramaId) {
      throw new BadRequestException(`${type} 类型导入必须指定 dramaId`);
    }

    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }

    const validRowIndices: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowErrors = await this.validateRow(type, row, dramaId, i);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRowIndices.push(i);
      }
    }

    const duplicateMap = await this.detectDuplicates(type, data, validRowIndices, dramaId);

    for (const [index, existing] of duplicateMap) {
      duplicates++;
      if (strategy === OverrideStrategy.SKIP) {
        warnings.push({ row: index, message: `数据重复将跳过: ${this.getDuplicateKey(type, data[index])}` });
      } else if (strategy === OverrideStrategy.OVERWRITE) {
        warnings.push({ row: index, message: `数据重复将覆盖已有记录 #${existing.id}` });
      } else if (strategy === OverrideStrategy.CREATE_NEW) {
        newRecords++;
      }
    }

    const validRecords = validRowIndices.length;
    const invalidRecords = data.length - validRecords;

    let willCreate = 0;
    let willUpdate = 0;
    let willSkip = 0;

    for (const idx of validRowIndices) {
      if (duplicateMap.has(idx)) {
        if (strategy === OverrideStrategy.SKIP) {
          willSkip++;
        } else if (strategy === OverrideStrategy.OVERWRITE) {
          willUpdate++;
        } else if (strategy === OverrideStrategy.CREATE_NEW) {
          willCreate++;
        }
      } else {
        willCreate++;
      }
    }

    await this.auditLogsService.log({
      action: AuditAction.IMPORT_PREVIEW,
      module: AuditModule.DATA_IMPORT,
      operatorId,
      operatorName,
      targetType: type,
      detail: `预览导入${this.getTypeLabel(type)}数据: 共${data.length}条, 有效${validRecords}条, 无效${invalidRecords}条, 重复${duplicates}条`,
      metadata: { type, totalRecords: data.length, validRecords, invalidRecords, duplicates, strategy, dramaId },
    });

    return {
      totalRecords: data.length,
      validRecords,
      invalidRecords,
      duplicates,
      newRecords,
      errors,
      warnings,
      preview: { willCreate, willUpdate, willSkip },
    };
  }

  async execute(req: ImportRequest, operatorId: number, operatorName: string): Promise<ImportExecuteResult> {
    const startTime = Date.now();
    const { type, data, dramaId, strategy } = req;

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('导入数据不能为空');
    }

    if (data.length > 1000) {
      throw new BadRequestException('单次导入数据不能超过1000条');
    }

    if ([ImportType.ROLES, ImportType.REHEARSALS, ImportType.MATERIALS].includes(type) && !dramaId) {
      throw new BadRequestException(`${type} 类型导入必须指定 dramaId`);
    }

    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }

    const errors: ImportError[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const validRowIndices: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const rowErrors = await this.validateRow(type, data[i], dramaId, i);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        failed++;
      } else {
        validRowIndices.push(i);
      }
    }

    const duplicateMap = await this.detectDuplicates(type, data, validRowIndices, dramaId);

    for (const idx of validRowIndices) {
      const row = data[idx];
      try {
        const existing = duplicateMap.get(idx);
        if (existing) {
          if (strategy === OverrideStrategy.SKIP) {
            skipped++;
            continue;
          } else if (strategy === OverrideStrategy.OVERWRITE) {
            await this.updateRecord(type, existing.id, row, dramaId, operatorId, operatorName);
            updated++;
          } else if (strategy === OverrideStrategy.CREATE_NEW) {
            await this.createRecord(type, row, dramaId, operatorId, operatorName);
            created++;
          }
        } else {
          await this.createRecord(type, row, dramaId, operatorId, operatorName);
          created++;
        }
      } catch (e: any) {
        errors.push({ row: idx, message: e.message || '导入失败', data: row });
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    const taskId = `import_${type}_${Date.now()}`;

    const result: ImportExecuteResult = {
      taskId,
      totalRecords: data.length,
      created,
      updated,
      skipped,
      failed,
      errors,
      duration,
    };

    importResultsStore.set(taskId, result);

    await this.auditLogsService.log({
      action: AuditAction.IMPORT_EXECUTE,
      module: AuditModule.DATA_IMPORT,
      operatorId,
      operatorName,
      targetType: type,
      detail: `执行导入${this.getTypeLabel(type)}数据: 共${data.length}条, 新建${created}条, 更新${updated}条, 跳过${skipped}条, 失败${failed}条, 耗时${duration}ms`,
      metadata: { type, taskId, totalRecords: data.length, created, updated, skipped, failed, strategy, dramaId, duration },
    });

    return result;
  }

  getErrorReceipt(taskId: string): ImportExecuteResult | null {
    return importResultsStore.get(taskId) || null;
  }

  private async validateRow(type: ImportType, row: any, dramaId: number | undefined, index: number): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    if (!row || typeof row !== 'object') {
      errors.push({ row: index, message: '数据格式错误: 必须为对象' });
      return errors;
    }

    switch (type) {
      case ImportType.USERS:
        return this.validateUserRow(row, index);
      case ImportType.ROLES:
        return this.validateRoleRow(row, index, dramaId);
      case ImportType.REHEARSALS:
        return this.validateRehearsalRow(row, index, dramaId);
      case ImportType.MATERIALS:
        return this.validateMaterialRow(row, index, dramaId);
      default:
        errors.push({ row: index, message: `不支持的导入类型: ${type}` });
        return errors;
    }
  }

  private async validateUserRow(row: any, index: number): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    if (!row.username || typeof row.username !== 'string' || row.username.trim() === '') {
      errors.push({ row: index, field: 'username', message: '用户名不能为空' });
    } else if (row.username.length > 50) {
      errors.push({ row: index, field: 'username', message: '用户名不能超过50个字符' });
    }

    if (!row.password || typeof row.password !== 'string' || row.password.length < 6) {
      errors.push({ row: index, field: 'password', message: '密码不能为空且至少6位' });
    }

    if (row.role && !Object.values(UserRole).includes(row.role)) {
      errors.push({ row: index, field: 'role', message: `角色值无效，有效值: ${Object.values(UserRole).join(', ')}` });
    }

    return errors;
  }

  private async validateRoleRow(row: any, index: number, dramaId: number | undefined): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    if (!row.characterName || typeof row.characterName !== 'string' || row.characterName.trim() === '') {
      errors.push({ row: index, field: 'characterName', message: '角色名称不能为空' });
    }

    if (row.actorId !== undefined && row.actorId !== null) {
      const user = await this.userRepo.findOne({ where: { id: row.actorId } });
      if (!user) {
        errors.push({ row: index, field: 'actorId', message: `演员ID #${row.actorId} 不存在` });
      }
    }

    if (row.substituteActorIds && Array.isArray(row.substituteActorIds)) {
      for (const sid of row.substituteActorIds) {
        const user = await this.userRepo.findOne({ where: { id: sid } });
        if (!user) {
          errors.push({ row: index, field: 'substituteActorIds', message: `替补演员ID #${sid} 不存在` });
        }
      }
    }

    if (row.priority !== undefined && (typeof row.priority !== 'number' || row.priority < 0)) {
      errors.push({ row: index, field: 'priority', message: '优先级必须为非负数字' });
    }

    return errors;
  }

  private async validateRehearsalRow(row: any, index: number, dramaId: number | undefined): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    if (!row.title || typeof row.title !== 'string' || row.title.trim() === '') {
      errors.push({ row: index, field: 'title', message: '排练标题不能为空' });
    }

    if (!row.startTime) {
      errors.push({ row: index, field: 'startTime', message: '开始时间不能为空' });
    }

    if (!row.endTime) {
      errors.push({ row: index, field: 'endTime', message: '结束时间不能为空' });
    }

    if (row.startTime && row.endTime) {
      const start = new Date(row.startTime);
      const end = new Date(row.endTime);
      if (isNaN(start.getTime())) {
        errors.push({ row: index, field: 'startTime', message: '开始时间格式无效' });
      }
      if (isNaN(end.getTime())) {
        errors.push({ row: index, field: 'endTime', message: '结束时间格式无效' });
      }
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start >= end) {
        errors.push({ row: index, field: 'endTime', message: '结束时间必须晚于开始时间' });
      }
    }

    if (row.participantIds && Array.isArray(row.participantIds)) {
      const existingUsers = await this.userRepo.findBy({ id: In(row.participantActorIds || row.participantIds) });
      const existingIds = new Set(existingUsers.map((u) => u.id));
      const ids = row.participantActorIds || row.participantIds;
      for (const pid of ids) {
        if (!existingIds.has(pid)) {
          errors.push({ row: index, field: 'participantIds', message: `参与者ID #${pid} 不存在` });
        }
      }
    }

    if (row.materialIds && Array.isArray(row.materialIds)) {
      const existingMaterials = await this.materialRepo.findBy({ id: In(row.materialIds) });
      const existingMatIds = new Set(existingMaterials.map((m) => m.id));
      for (const mid of row.materialIds) {
        if (!existingMatIds.has(mid)) {
          errors.push({ row: index, field: 'materialIds', message: `素材ID #${mid} 不存在` });
        }
      }
    }

    return errors;
  }

  private async validateMaterialRow(row: any, index: number, dramaId: number | undefined): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    if (!row.originalName || typeof row.originalName !== 'string' || row.originalName.trim() === '') {
      errors.push({ row: index, field: 'originalName', message: '素材名称不能为空' });
    }

    if (row.categories && !Array.isArray(row.categories)) {
      errors.push({ row: index, field: 'categories', message: '分类必须为数组' });
    }

    if (row.tags && !Array.isArray(row.tags)) {
      errors.push({ row: index, field: 'tags', message: '标签必须为数组' });
    }

    if (row.downloadRoles && !Array.isArray(row.downloadRoles)) {
      errors.push({ row: index, field: 'downloadRoles', message: '下载权限角色必须为数组' });
    }

    if (row.size !== undefined && (typeof row.size !== 'number' || row.size < 0)) {
      errors.push({ row: index, field: 'size', message: '文件大小必须为非负数字' });
    }

    return errors;
  }

  private async detectDuplicates(
    type: ImportType,
    data: any[],
    validIndices: number[],
    dramaId: number | undefined,
  ): Promise<Map<number, any>> {
    const duplicateMap = new Map<number, any>();

    switch (type) {
      case ImportType.USERS:
        return this.detectUserDuplicates(data, validIndices);
      case ImportType.ROLES:
        return this.detectRoleDuplicates(data, validIndices, dramaId);
      case ImportType.REHEARSALS:
        return this.detectRehearsalDuplicates(data, validIndices, dramaId);
      case ImportType.MATERIALS:
        return this.detectMaterialDuplicates(data, validIndices, dramaId);
      default:
        return duplicateMap;
    }
  }

  private async detectUserDuplicates(data: any[], validIndices: number[]): Promise<Map<number, any>> {
    const duplicateMap = new Map<number, any>();
    const usernames = validIndices.map((i) => data[i].username).filter(Boolean);
    if (usernames.length === 0) return duplicateMap;

    const existingUsers = await this.userRepo.find({ where: { username: In(usernames) } });
    const userMap = new Map(existingUsers.map((u) => [u.username, u]));

    for (const idx of validIndices) {
      const existing = userMap.get(data[idx].username);
      if (existing) {
        duplicateMap.set(idx, existing);
      }
    }
    return duplicateMap;
  }

  private async detectRoleDuplicates(data: any[], validIndices: number[], dramaId: number | undefined): Promise<Map<number, any>> {
    const duplicateMap = new Map<number, any>();
    if (!dramaId) return duplicateMap;

    const existingRoles = await this.roleRepo.find({ where: { dramaId } });
    const roleMap = new Map(existingRoles.map((r) => [r.characterName, r]));

    for (const idx of validIndices) {
      const existing = roleMap.get(data[idx].characterName);
      if (existing) {
        duplicateMap.set(idx, existing);
      }
    }
    return duplicateMap;
  }

  private async detectRehearsalDuplicates(data: any[], validIndices: number[], dramaId: number | undefined): Promise<Map<number, any>> {
    const duplicateMap = new Map<number, any>();
    if (!dramaId) return duplicateMap;

    const existingRehearsals = await this.rehearsalRepo.find({ where: { dramaId } });

    for (const idx of validIndices) {
      const row = data[idx];
      const matchingRehearsal = existingRehearsals.find(
        (r) => r.title === row.title && r.location === (row.location || null),
      );
      if (matchingRehearsal) {
        duplicateMap.set(idx, matchingRehearsal);
      }
    }
    return duplicateMap;
  }

  private async detectMaterialDuplicates(data: any[], validIndices: number[], dramaId: number | undefined): Promise<Map<number, any>> {
    const duplicateMap = new Map<number, any>();
    if (!dramaId) return duplicateMap;

    const existingMaterials = await this.materialRepo.find({ where: { dramaId } });
    const materialMap = new Map(existingMaterials.map((m) => [m.originalName, m]));

    for (const idx of validIndices) {
      const existing = materialMap.get(data[idx].originalName);
      if (existing) {
        duplicateMap.set(idx, existing);
      }
    }
    return duplicateMap;
  }

  private getDuplicateKey(type: ImportType, row: any): string {
    switch (type) {
      case ImportType.USERS:
        return row.username;
      case ImportType.ROLES:
        return row.characterName;
      case ImportType.REHEARSALS:
        return `${row.title}${row.location ? '@' + row.location : ''}`;
      case ImportType.MATERIALS:
        return row.originalName;
      default:
        return '';
    }
  }

  private async createRecord(type: ImportType, row: any, dramaId: number | undefined, operatorId: number, operatorName: string): Promise<any> {
    switch (type) {
      case ImportType.USERS:
        return this.createUser(row, operatorId, operatorName);
      case ImportType.ROLES:
        return this.createRole(row, dramaId!, operatorId, operatorName);
      case ImportType.REHEARSALS:
        return this.createRehearsal(row, dramaId!, operatorId, operatorName);
      case ImportType.MATERIALS:
        return this.createMaterial(row, dramaId!, operatorId, operatorName);
    }
  }

  private async updateRecord(type: ImportType, id: number, row: any, dramaId: number | undefined, operatorId: number, operatorName: string): Promise<any> {
    switch (type) {
      case ImportType.USERS:
        return this.updateUser(id, row, operatorId, operatorName);
      case ImportType.ROLES:
        return this.updateRole(id, row, operatorId, operatorName);
      case ImportType.REHEARSALS:
        return this.updateRehearsal(id, row, operatorId, operatorName);
      case ImportType.MATERIALS:
        return this.updateMaterial(id, row, operatorId, operatorName);
    }
  }

  private async createUser(row: any, operatorId: number, operatorName: string) {
    const entity = this.userRepo.create({
      username: row.username,
      password: row.password,
      role: row.role || UserRole.VIEWER,
      displayName: row.displayName || null,
    });
    const saved = await this.userRepo.save(entity);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_USER,
      module: AuditModule.USER,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'user',
      targetUsername: saved.username,
      detail: `批量导入创建用户 ${saved.username}`,
      metadata: { username: saved.username, role: saved.role, displayName: saved.displayName },
    });

    return saved;
  }

  private async updateUser(id: number, row: any, operatorId: number, operatorName: string) {
    const updateData: Partial<User> = {};
    if (row.role !== undefined) updateData.role = row.role;
    if (row.displayName !== undefined) updateData.displayName = row.displayName;
    if (row.password !== undefined) updateData.password = row.password;

    await this.userRepo.update(id, updateData);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_USER_ROLE,
      module: AuditModule.USER,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'user',
      detail: `批量导入更新用户 #${id}`,
      metadata: { id, updateData },
    });

    return this.userRepo.findOne({ where: { id } });
  }

  private async createRole(row: any, dramaId: number, operatorId: number, operatorName: string) {
    const entity = this.roleRepo.create({
      characterName: row.characterName,
      characterDescription: row.characterDescription || null,
      actorId: row.actorId || null,
      substituteActorIds: row.substituteActorIds || [],
      sceneNumbers: row.sceneNumbers || [],
      priority: row.priority || 0,
      dramaId,
      createdBy: operatorId,
    });
    const saved = await this.roleRepo.save(entity);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_ROLE,
      module: AuditModule.ROLE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'role',
      detail: `批量导入在剧目 #${dramaId} 创建角色「${saved.characterName}」`,
      metadata: { characterName: saved.characterName, actorId: saved.actorId, dramaId },
    });

    return saved;
  }

  private async updateRole(id: number, row: any, operatorId: number, operatorName: string) {
    const updateData: Partial<CastRole> = {};
    if (row.characterName !== undefined) updateData.characterName = row.characterName;
    if (row.characterDescription !== undefined) updateData.characterDescription = row.characterDescription;
    if (row.actorId !== undefined) updateData.actorId = row.actorId;
    if (row.substituteActorIds !== undefined) updateData.substituteActorIds = row.substituteActorIds;
    if (row.sceneNumbers !== undefined) updateData.sceneNumbers = row.sceneNumbers;
    if (row.priority !== undefined) updateData.priority = row.priority;

    await this.roleRepo.update(id, updateData);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_ROLE,
      module: AuditModule.ROLE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'role',
      detail: `批量导入更新角色 #${id}`,
      metadata: { id, updateData },
    });

    return this.roleRepo.findOne({ where: { id } });
  }

  private async createRehearsal(row: any, dramaId: number, operatorId: number, operatorName: string) {
    const startTime = new Date(row.startTime);
    const endTime = new Date(row.endTime);

    const entity = this.rehearsalRepo.create({
      title: row.title,
      description: row.description || null,
      startTime,
      endTime,
      location: row.location || null,
      participantIds: row.participantIds || row.participantActorIds || [],
      materialIds: row.materialIds || [],
      dramaId,
      createdBy: operatorId,
    });
    const saved = await this.rehearsalRepo.save(entity);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_REHEARSAL,
      module: AuditModule.REHEARSAL,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'rehearsal',
      detail: `批量导入在剧目 #${dramaId} 创建排练「${saved.title}」`,
      metadata: { title: saved.title, location: saved.location, startTime: saved.startTime, endTime: saved.endTime, dramaId },
    });

    return saved;
  }

  private async updateRehearsal(id: number, row: any, operatorId: number, operatorName: string) {
    const updateData: Partial<Rehearsal> = {};
    if (row.title !== undefined) updateData.title = row.title;
    if (row.description !== undefined) updateData.description = row.description;
    if (row.startTime !== undefined) updateData.startTime = new Date(row.startTime);
    if (row.endTime !== undefined) updateData.endTime = new Date(row.endTime);
    if (row.location !== undefined) updateData.location = row.location;
    if (row.participantIds !== undefined || row.participantActorIds !== undefined) {
      updateData.participantIds = row.participantIds || row.participantActorIds;
    }
    if (row.materialIds !== undefined) updateData.materialIds = row.materialIds;

    await this.rehearsalRepo.update(id, updateData);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_REHEARSAL,
      module: AuditModule.REHEARSAL,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'rehearsal',
      detail: `批量导入更新排练 #${id}`,
      metadata: { id, updateData },
    });

    return this.rehearsalRepo.findOne({ where: { id } });
  }

  private async createMaterial(row: any, dramaId: number, operatorId: number, operatorName: string) {
    const entity = this.materialRepo.create({
      originalName: row.originalName,
      storedName: row.storedName || `import_${Date.now()}_${row.originalName}`,
      mimeType: row.mimeType || 'application/octet-stream',
      size: row.size || 0,
      category: row.category || null,
      categories: row.categories || (row.category ? [row.category] : ['general']),
      tags: row.tags || [],
      downloadRoles: row.downloadRoles || [],
      description: row.description || null,
      version: 1,
      baseName: row.baseName || row.originalName,
      dramaId,
      createdBy: operatorId,
    });
    const saved = await this.materialRepo.save(entity);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_MATERIAL,
      module: AuditModule.MATERIAL,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'material',
      detail: `批量导入在剧目 #${dramaId} 创建素材「${saved.originalName}」`,
      metadata: { originalName: saved.originalName, categories: saved.categories, dramaId },
    });

    return saved;
  }

  private async updateMaterial(id: number, row: any, operatorId: number, operatorName: string) {
    const updateData: Partial<Material> = {};
    if (row.originalName !== undefined) updateData.originalName = row.originalName;
    if (row.description !== undefined) updateData.description = row.description;
    if (row.categories !== undefined) updateData.categories = row.categories;
    if (row.tags !== undefined) updateData.tags = row.tags;
    if (row.downloadRoles !== undefined) updateData.downloadRoles = row.downloadRoles;
    if (row.category !== undefined) updateData.category = row.category;

    await this.materialRepo.update(id, updateData);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_MATERIAL,
      module: AuditModule.MATERIAL,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material',
      detail: `批量导入更新素材 #${id}`,
      metadata: { id, updateData },
    });

    return this.materialRepo.findOne({ where: { id } });
  }

  private getTypeLabel(type: ImportType): string {
    const labels: Record<ImportType, string> = {
      [ImportType.USERS]: '用户',
      [ImportType.ROLES]: '角色',
      [ImportType.REHEARSALS]: '排练',
      [ImportType.MATERIALS]: '素材',
    };
    return labels[type] || type;
  }
}
