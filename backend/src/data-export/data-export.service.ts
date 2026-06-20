import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import * as XLSX from 'xlsx';
import { Parser } from 'json2csv';
import {
  Rehearsal,
  CastRole,
  Annotation,
  Material,
  User,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';

export enum ExportType {
  REHEARSALS = 'rehearsals',
  ROLES = 'roles',
  ANNOTATIONS = 'annotations',
  MATERIALS = 'materials',
}

export enum ExportFormat {
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

export interface ExportFilter {
  dramaId?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  category?: string;
  status?: string;
  participantId?: number;
  sceneNumber?: number;
  tag?: string;
  ids?: number[];
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface ColumnConfig {
  key: string;
  label: string;
  formatter?: (value: any, row: any) => any;
}

const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  [ExportType.REHEARSALS]: '排练计划',
  [ExportType.ROLES]: '角色清单',
  [ExportType.ANNOTATIONS]: '批注记录',
  [ExportType.MATERIALS]: '素材目录',
};

const FORMAT_MIME_TYPES: Record<ExportFormat, string> = {
  [ExportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [ExportFormat.CSV]: 'text/csv; charset=utf-8',
  [ExportFormat.JSON]: 'application/json; charset=utf-8',
};

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  [ExportFormat.EXCEL]: 'xlsx',
  [ExportFormat.CSV]: 'csv',
  [ExportFormat.JSON]: 'json',
};

@Injectable()
export class DataExportService {
  constructor(
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => DramasService))
    private dramasService: DramasService,
  ) {}

  async export(
    type: ExportType,
    format: ExportFormat,
    filter: ExportFilter,
    operatorId: number,
    operatorName: string,
  ): Promise<ExportResult> {
    if (!Object.values(ExportType).includes(type)) {
      throw new BadRequestException(`不支持的导出类型: ${type}`);
    }

    if (!Object.values(ExportFormat).includes(format)) {
      throw new BadRequestException(`不支持的导出格式: ${format}`);
    }

    if (filter.dramaId) {
      await this.dramasService.checkAccess(filter.dramaId, operatorId, ['viewer']);
    }

    let data: any[];
    let columns: ColumnConfig[];

    switch (type) {
      case ExportType.REHEARSALS:
        data = await this.getRehearsalsData(filter, operatorId);
        columns = this.getRehearsalColumns();
        break;
      case ExportType.ROLES:
        data = await this.getRolesData(filter, operatorId);
        columns = this.getRoleColumns();
        break;
      case ExportType.ANNOTATIONS:
        data = await this.getAnnotationsData(filter, operatorId);
        columns = this.getAnnotationColumns();
        break;
      case ExportType.MATERIALS:
        data = await this.getMaterialsData(filter, operatorId);
        columns = this.getMaterialColumns();
        break;
      default:
        throw new BadRequestException(`不支持的导出类型: ${type}`);
    }

    if (data.length === 0) {
      throw new BadRequestException('没有符合条件的数据可导出');
    }

    const formattedData = data.map((row) => this.formatRow(row, columns));

    let buffer: Buffer;
    switch (format) {
      case ExportFormat.EXCEL:
        buffer = this.toExcel(formattedData, columns, EXPORT_TYPE_LABELS[type]);
        break;
      case ExportFormat.CSV:
        buffer = this.toCSV(formattedData, columns);
        break;
      case ExportFormat.JSON:
        buffer = this.toJSON(formattedData);
        break;
    }

    await this.auditLogsService.log({
      action: AuditAction.EXPORT_DATA,
      module: AuditModule.DATA_EXPORT,
      operatorId,
      operatorName,
      targetType: type,
      detail: `导出${EXPORT_TYPE_LABELS[type]}数据: 共${data.length}条, 格式: ${format.toUpperCase()}`,
      metadata: { type, format, count: data.length, filter, dramaId: filter.dramaId },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${EXPORT_TYPE_LABELS[type]}_${timestamp}.${FORMAT_EXTENSIONS[format]}`;

    return {
      buffer,
      filename,
      mimeType: FORMAT_MIME_TYPES[format],
    };
  }

  getAvailableTypes(): Array<{ type: ExportType; label: string }> {
    return Object.entries(EXPORT_TYPE_LABELS).map(([type, label]) => ({
      type: type as ExportType,
      label,
    }));
  }

  getAvailableFormats(): Array<{ format: ExportFormat; label: string }> {
    return [
      { format: ExportFormat.EXCEL, label: 'Excel (.xlsx)' },
      { format: ExportFormat.CSV, label: 'CSV (.csv)' },
      { format: ExportFormat.JSON, label: 'JSON (.json)' },
    ];
  }

  private async getRehearsalsData(filter: ExportFilter, userId: number): Promise<any[]> {
    const dramaIds = filter.dramaId
      ? [filter.dramaId]
      : await this.dramasService.getUserDramaIds(userId);

    if (dramaIds.length === 0) return [];

    let where: any = { dramaId: In(dramaIds) };

    if (filter.startDate && filter.endDate) {
      where.startTime = Between(new Date(filter.startDate), new Date(filter.endDate));
    }

    let rehearsals = await this.rehearsalRepo.find({
      where,
      order: { startTime: 'ASC' },
    });

    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      rehearsals = rehearsals.filter(
        (r) =>
          r.title.toLowerCase().includes(kw) ||
          r.description?.toLowerCase().includes(kw) ||
          r.location?.toLowerCase().includes(kw),
      );
    }

    if (filter.participantId) {
      rehearsals = rehearsals.filter((r) =>
        (r.participantIds || []).includes(filter.participantId!),
      );
    }

    if (filter.ids && filter.ids.length > 0) {
      rehearsals = rehearsals.filter((r) => filter.ids!.includes(r.id));
    }

    const users = await this.userRepo.findByIds(
      Array.from(new Set(rehearsals.flatMap((r) => r.participantIds || []))),
    );
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rehearsals.map((r) => ({
      ...r,
      participants: (r.participantIds || [])
        .map((id) => {
          const u = userMap.get(id);
          return u ? u.displayName || u.username : `#${id}`;
        })
        .join('、'),
      participantCount: (r.participantIds || []).length,
      materialCount: (r.materialIds || []).length,
      presentCount: this.countAttendance(r, 'present'),
      absentCount: this.countAttendance(r, 'absent'),
      lateCount: this.countAttendance(r, 'late'),
    }));
  }

  private countAttendance(rehearsal: Rehearsal, status: string): number {
    const attendance = rehearsal.attendance || {};
    return Object.values(attendance).filter((a) => a?.status === status).length;
  }

  private getRehearsalColumns(): ColumnConfig[] {
    return [
      { key: 'id', label: 'ID' },
      { key: 'title', label: '排练标题' },
      { key: 'description', label: '描述' },
      { key: 'startTime', label: '开始时间', formatter: (v) => this.formatDate(v) },
      { key: 'endTime', label: '结束时间', formatter: (v) => this.formatDate(v) },
      { key: 'location', label: '地点' },
      { key: 'participants', label: '参与人员' },
      { key: 'participantCount', label: '参与人数' },
      { key: 'materialCount', label: '关联素材数' },
      { key: 'presentCount', label: '出勤人数' },
      { key: 'absentCount', label: '缺席人数' },
      { key: 'lateCount', label: '迟到人数' },
      { key: 'createdAt', label: '创建时间', formatter: (v) => this.formatDate(v) },
    ];
  }

  private async getRolesData(filter: ExportFilter, userId: number): Promise<any[]> {
    const dramaIds = filter.dramaId
      ? [filter.dramaId]
      : await this.dramasService.getUserDramaIds(userId);

    if (dramaIds.length === 0) return [];

    let roles = await this.roleRepo.find({
      where: { dramaId: In(dramaIds) },
      order: { priority: 'ASC' },
    });

    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      roles = roles.filter(
        (r) =>
          r.characterName.toLowerCase().includes(kw) ||
          r.characterDescription?.toLowerCase().includes(kw),
      );
    }

    if (filter.status === 'assigned') {
      roles = roles.filter((r) => r.actorId != null);
    } else if (filter.status === 'unassigned') {
      roles = roles.filter((r) => r.actorId == null);
    }

    if (filter.ids && filter.ids.length > 0) {
      roles = roles.filter((r) => filter.ids!.includes(r.id));
    }

    const allActorIds = new Set<number>();
    roles.forEach((r) => {
      if (r.actorId) allActorIds.add(r.actorId);
      (r.substituteActorIds || []).forEach((id) => allActorIds.add(id));
    });

    const users = await this.userRepo.findByIds(Array.from(allActorIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return roles.map((r) => {
      const actor = r.actorId ? userMap.get(r.actorId) : null;
      const substitutes = (r.substituteActorIds || [])
        .map((id) => {
          const u = userMap.get(id);
          return u ? u.displayName || u.username : `#${id}`;
        })
        .join('、');

      return {
        ...r,
        actorName: actor ? actor.displayName || actor.username : '未分配',
        substituteActors: substitutes || '无',
        sceneNumbers: (r.sceneNumbers || []).join('、') || '无',
      };
    });
  }

  private getRoleColumns(): ColumnConfig[] {
    return [
      { key: 'id', label: 'ID' },
      { key: 'characterName', label: '角色名称' },
      { key: 'characterDescription', label: '角色描述' },
      { key: 'actorName', label: '饰演演员' },
      { key: 'substituteActors', label: '替补演员' },
      { key: 'sceneNumbers', label: '出场场次' },
      { key: 'priority', label: '优先级' },
      { key: 'createdAt', label: '创建时间', formatter: (v) => this.formatDate(v) },
    ];
  }

  private async getAnnotationsData(filter: ExportFilter, userId: number): Promise<any[]> {
    const dramaIds = filter.dramaId
      ? [filter.dramaId]
      : await this.dramasService.getUserDramaIds(userId);

    if (dramaIds.length === 0) return [];

    let where: any = { dramaId: In(dramaIds) };

    if (filter.sceneNumber != null) {
      where.sceneNumber = filter.sceneNumber;
    }

    if (filter.tag) {
      where.tag = filter.tag;
    }

    let annotations = await this.annotationRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      annotations = annotations.filter(
        (a) =>
          a.scriptContent.toLowerCase().includes(kw) ||
          a.note?.toLowerCase().includes(kw),
      );
    }

    if (filter.ids && filter.ids.length > 0) {
      annotations = annotations.filter((a) => filter.ids!.includes(a.id));
    }

    const userIds = Array.from(new Set(annotations.map((a) => a.createdBy).filter(Boolean)));
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return annotations.map((a) => {
      const creator = a.createdBy ? userMap.get(a.createdBy) : null;
      return {
        ...a,
        creatorName: creator ? creator.displayName || creator.username : '未知',
        scriptContentPreview:
          a.scriptContent.length > 100
            ? a.scriptContent.substring(0, 100) + '...'
            : a.scriptContent,
        materialCount: (a.materialIds || []).length,
        sceneLabel: a.sceneNumber != null ? `第${a.sceneNumber}场` : '未指定',
      };
    });
  }

  private getAnnotationColumns(): ColumnConfig[] {
    return [
      { key: 'id', label: 'ID' },
      { key: 'sceneLabel', label: '场次' },
      { key: 'scriptContentPreview', label: '台词内容' },
      { key: 'note', label: '批注内容' },
      { key: 'tag', label: '标签' },
      { key: 'tagColor', label: '标签颜色' },
      { key: 'creatorName', label: '创建人' },
      { key: 'materialCount', label: '关联素材数' },
      { key: 'createdAt', label: '创建时间', formatter: (v) => this.formatDate(v) },
    ];
  }

  private async getMaterialsData(filter: ExportFilter, userId: number): Promise<any[]> {
    const dramaIds = filter.dramaId
      ? [filter.dramaId]
      : await this.dramasService.getUserDramaIds(userId);

    if (dramaIds.length === 0) return [];

    let materials = await this.materialRepo.find({
      where: { dramaId: In(dramaIds) },
      order: { createdAt: 'DESC' },
    });

    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      materials = materials.filter(
        (m) =>
          m.originalName.toLowerCase().includes(kw) ||
          m.description?.toLowerCase().includes(kw),
      );
    }

    if (filter.category) {
      materials = materials.filter(
        (m) =>
          m.categories?.includes(filter.category!) || m.category === filter.category,
      );
    }

    if (filter.ids && filter.ids.length > 0) {
      materials = materials.filter((m) => filter.ids!.includes(m.id));
    }

    const userIds = Array.from(new Set(materials.map((m) => m.createdBy).filter(Boolean)));
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return materials.map((m) => {
      const creator = m.createdBy ? userMap.get(m.createdBy) : null;
      return {
        ...m,
        creatorName: creator ? creator.displayName || creator.username : '未知',
        sizeFormatted: this.formatFileSize(m.size),
        categories: (m.categories || []).join('、') || m.category || '未分类',
        tags: (m.tags || []).join('、') || '无',
        downloadRoles: (m.downloadRoles || []).join('、') || '所有用户',
      };
    });
  }

  private getMaterialColumns(): ColumnConfig[] {
    return [
      { key: 'id', label: 'ID' },
      { key: 'originalName', label: '文件名称' },
      { key: 'description', label: '描述' },
      { key: 'mimeType', label: '文件类型' },
      { key: 'sizeFormatted', label: '文件大小' },
      { key: 'version', label: '版本' },
      { key: 'categories', label: '分类' },
      { key: 'tags', label: '标签' },
      { key: 'creatorName', label: '上传人' },
      { key: 'downloadRoles', label: '下载权限' },
      { key: 'createdAt', label: '上传时间', formatter: (v) => this.formatDate(v) },
    ];
  }

  private formatRow(row: any, columns: ColumnConfig[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const col of columns) {
      const value = row[col.key];
      result[col.label] = col.formatter ? col.formatter(value, row) : value ?? '';
    }
    return result;
  }

  private toExcel(data: any[], columns: ColumnConfig[], sheetName: string): Buffer {
    const ws = XLSX.utils.json_to_sheet(data);

    const colWidths = columns.map((col) => ({
      wch: Math.min(Math.max(col.label.length * 2, 10), 50),
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  private toCSV(data: any[], columns: ColumnConfig[]): Buffer {
    const fields = columns.map((col) => col.label);
    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    const bom = '\uFEFF';
    return Buffer.from(bom + csv, 'utf-8');
  }

  private toJSON(data: any[]): Buffer {
    return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  }

  private formatDate(value: any): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async getPreview(
    type: ExportType,
    filter: ExportFilter,
    userId: number,
  ): Promise<{ total: number; preview: any[] }> {
    let data: any[];

    switch (type) {
      case ExportType.REHEARSALS:
        data = await this.getRehearsalsData(filter, userId);
        break;
      case ExportType.ROLES:
        data = await this.getRolesData(filter, userId);
        break;
      case ExportType.ANNOTATIONS:
        data = await this.getAnnotationsData(filter, userId);
        break;
      case ExportType.MATERIALS:
        data = await this.getMaterialsData(filter, userId);
        break;
      default:
        throw new BadRequestException(`不支持的导出类型: ${type}`);
    }

    return {
      total: data.length,
      preview: data.slice(0, 10),
    };
  }
}
