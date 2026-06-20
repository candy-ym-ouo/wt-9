import { Injectable, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  Share,
  ShareTargetType,
  ShareStatus,
  AccessScope,
  User,
  Drama,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';

@Injectable()
export class SharesService {
  constructor(
    @InjectRepository(Share)
    private shareRepo: Repository<Share>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Drama)
    private dramaRepo: Repository<Drama>,
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => DramasService))
    private dramasService: DramasService,
  ) {}

  async create(
    data: {
      targetType: ShareTargetType;
      targetId: number;
      dramaId: number;
      accessScope?: AccessScope;
      allowDownload?: boolean;
      password?: string;
      expiresAt?: Date;
      maxAccessCount?: number;
      allowedIpRanges?: string[];
      description?: string;
    },
    operatorId: number,
    operatorName: string,
  ): Promise<Share> {
    await this.dramasService.checkAccess(data.dramaId, operatorId, ['owner', 'director']);

    const token = this.generateToken();
    const hashedPassword = data.password ? this.hashPassword(data.password) : null;

    const shareData = {
      targetType: data.targetType,
      targetId: data.targetId,
      dramaId: data.dramaId,
      token,
      password: hashedPassword,
      createdBy: operatorId,
      accessScope: data.accessScope || AccessScope.READ_ONLY,
      allowDownload: data.allowDownload || false,
      expiresAt: data.expiresAt,
      maxAccessCount: data.maxAccessCount,
      allowedIpRanges: data.allowedIpRanges,
      description: data.description,
    };

    const share = this.shareRepo.create(shareData as any);
    const saved = await this.shareRepo.save(share) as any;

    await this.auditLogsService.log({
      action: AuditAction.CREATE_SHARE,
      module: AuditModule.SHARE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'share',
      detail: `创建分享链接：${data.targetType} #${data.targetId}，访问范围：${data.accessScope || AccessScope.READ_ONLY}`,
      metadata: {
        targetType: data.targetType,
        targetId: data.targetId,
        dramaId: data.dramaId,
        accessScope: data.accessScope,
        allowDownload: data.allowDownload,
        hasPassword: !!data.password,
        expiresAt: data.expiresAt,
      },
    });

    return this.findOne(saved.id, operatorId) as Promise<Share>;
  }

  async findAll(dramaId: number | undefined, userId: number): Promise<Share[]> {
    const dramaIds = await this.dramasService.getUserDramaIds(userId);
    if (dramaIds.length === 0) return [];

    const where: any = { dramaId: dramaIds };
    if (dramaId) {
      if (!dramaIds.includes(dramaId)) return [];
      where.dramaId = dramaId;
    }

    const shares = await this.shareRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['creator'],
    });

    return this.enrichWithCreatorInfo(shares);
  }

  async findOne(id: number, userId: number): Promise<Share | null> {
    const share = await this.shareRepo.findOne({ where: { id }, relations: ['creator'] });
    if (!share) return null;

    await this.dramasService.checkAccess(share.dramaId, userId, ['viewer']);

    const enriched = await this.enrichWithCreatorInfo([share]);
    return enriched[0];
  }

  async findByToken(token: string): Promise<Share | null> {
    const share = await this.shareRepo.findOne({ where: { token } });
    if (!share) return null;

    if (share.status === ShareStatus.EXPIRED || share.status === ShareStatus.REVOKED) {
      return null;
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      share.status = ShareStatus.EXPIRED;
      await this.shareRepo.update(share.id, { status: ShareStatus.EXPIRED });
      return null;
    }

    return share;
  }

  async update(
    id: number,
    data: Partial<{
      accessScope: AccessScope;
      allowDownload: boolean;
      password: string;
      expiresAt: Date;
      maxAccessCount: number;
      allowedIpRanges: string[];
      description: string;
    }>,
    operatorId: number,
    operatorName: string,
  ): Promise<Share> {
    const share = await this.shareRepo.findOne({ where: { id } });
    if (!share) throw new NotFoundException('分享链接不存在');

    await this.dramasService.checkAccess(share.dramaId, operatorId, ['owner', 'director']);

    const updateData: any = { ...data };
    if (data.password !== undefined) {
      updateData.password = data.password ? this.hashPassword(data.password) : null;
    }

    await this.shareRepo.update(id, updateData);

    const changes: string[] = [];
    if (data.accessScope !== undefined && data.accessScope !== share.accessScope) {
      changes.push(`访问范围: ${share.accessScope} → ${data.accessScope}`);
    }
    if (data.allowDownload !== undefined && data.allowDownload !== share.allowDownload) {
      changes.push(`允许下载: ${share.allowDownload} → ${data.allowDownload}`);
    }
    if (data.expiresAt !== undefined) {
      changes.push(`过期时间: ${share.expiresAt || '无'} → ${data.expiresAt || '无'}`);
    }
    if (data.password !== undefined) {
      changes.push(`密码: ${share.password ? '已设置' : '无'} → ${data.password ? '已更新' : '已清除'}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_SHARE,
      module: AuditModule.SHARE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'share',
      detail: changes.length > 0
        ? `更新分享链接: ${changes.join('; ')}`
        : `更新分享链接`,
      metadata: { old: share, new: data },
    });

    return this.findOne(id, operatorId) as Promise<Share>;
  }

  async revoke(id: number, operatorId: number, operatorName: string): Promise<void> {
    const share = await this.shareRepo.findOne({ where: { id } });
    if (!share) throw new NotFoundException('分享链接不存在');

    await this.dramasService.checkAccess(share.dramaId, operatorId, ['owner', 'director']);

    await this.shareRepo.update(id, { status: ShareStatus.REVOKED });

    await this.auditLogsService.log({
      action: AuditAction.REVOKE_SHARE,
      module: AuditModule.SHARE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'share',
      detail: `撤销分享链接：${share.targetType} #${share.targetId}`,
      metadata: { targetType: share.targetType, targetId: share.targetId, dramaId: share.dramaId },
    });
  }

  async extend(id: number, newExpiresAt: Date, operatorId: number, operatorName: string): Promise<Share> {
    const share = await this.shareRepo.findOne({ where: { id } });
    if (!share) throw new NotFoundException('分享链接不存在');

    await this.dramasService.checkAccess(share.dramaId, operatorId, ['owner', 'director']);

    await this.shareRepo.update(id, { expiresAt: newExpiresAt, status: ShareStatus.ACTIVE });

    await this.auditLogsService.log({
      action: AuditAction.EXTEND_SHARE,
      module: AuditModule.SHARE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'share',
      detail: `续期分享链接，新过期时间：${newExpiresAt.toISOString()}`,
      metadata: { oldExpiresAt: share.expiresAt, newExpiresAt },
    });

    return this.findOne(id, operatorId) as Promise<Share>;
  }

  async incrementAccessCount(id: number): Promise<void> {
    await this.shareRepo.increment({ id }, 'accessCount', 1);
  }

  validatePassword(share: Share, password: string): boolean {
    if (!share.password) return true;
    return this.hashPassword(password) === share.password;
  }

  validateIp(share: Share, ipAddress: string): boolean {
    if (!share.allowedIpRanges || share.allowedIpRanges.length === 0) return true;
    return share.allowedIpRanges.some((range) => this.ipInRange(ipAddress, range));
  }

  validateAccessCount(share: Share): boolean {
    if (!share.maxAccessCount || share.maxAccessCount === 0) return true;
    return share.accessCount < share.maxAccessCount;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private ipInRange(ip: string, range: string): boolean {
    if (range.includes('/')) {
      const [rangeIp, prefix] = range.split('/');
      const prefixLength = parseInt(prefix, 10);
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(rangeIp);
      const mask = 0xFFFFFFFF << (32 - prefixLength);
      return (ipNum & mask) === (rangeNum & mask);
    }
    return ip === range;
  }

  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet, index) => {
      return acc + (parseInt(octet, 10) << (24 - index * 8));
    }, 0);
  }

  private async enrichWithCreatorInfo(shares: Share[]): Promise<any[]> {
    const userIds = new Set<number>();
    shares.forEach((s) => userIds.add(s.createdBy));

    const users = await this.userRepo.findByIds(Array.from(userIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return shares.map((s) => {
      const creator = userMap.get(s.createdBy);
      return {
        ...s,
        password: undefined,
        creatorName: creator?.displayName || creator?.username,
      };
    });
  }
}
