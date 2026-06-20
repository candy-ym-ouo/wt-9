import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Share,
  ShareStatus,
  Visitor,
  VisitorAccessLog,
  VisitorAction,
  Drama,
  Script,
  CastRole,
  Rehearsal,
  Material,
  DramaPermission,
} from '../entities';
import { SharesService } from './shares.service';

@Injectable()
export class VisitorAccessService {
  constructor(
    @InjectRepository(Share)
    private shareRepo: Repository<Share>,
    @InjectRepository(Visitor)
    private visitorRepo: Repository<Visitor>,
    @InjectRepository(VisitorAccessLog)
    private accessLogRepo: Repository<VisitorAccessLog>,
    @InjectRepository(Drama)
    private dramaRepo: Repository<Drama>,
    @InjectRepository(Script)
    private scriptRepo: Repository<Script>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(DramaPermission)
    private permissionRepo: Repository<DramaPermission>,
    private sharesService: SharesService,
  ) {}

  async verifyShare(
    token: string,
    password: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ share: Share; needsPassword: boolean; visitor: Visitor | null }> {
    const share = await this.sharesService.findByToken(token);
    if (!share) {
      await this.logAccess({
        shareId: 0,
        action: VisitorAction.ACCESS,
        success: false,
        failureReason: '分享链接不存在或已失效',
        ipAddress,
        userAgent,
      });
      throw new NotFoundException('分享链接不存在或已失效');
    }

    if (share.status !== ShareStatus.ACTIVE) {
      await this.logAccess({
        shareId: share.id,
        action: VisitorAction.ACCESS,
        success: false,
        failureReason: '分享链接已失效',
        ipAddress,
        userAgent,
      });
      throw new ForbiddenException('分享链接已失效');
    }

    if (!this.sharesService.validateAccessCount(share)) {
      await this.logAccess({
        shareId: share.id,
        action: VisitorAction.ACCESS,
        success: false,
        failureReason: '访问次数已达上限',
        ipAddress,
        userAgent,
      });
      throw new ForbiddenException('访问次数已达上限');
    }

    if (!this.sharesService.validateIp(share, ipAddress)) {
      await this.logAccess({
        shareId: share.id,
        action: VisitorAction.ACCESS,
        success: false,
        failureReason: 'IP地址不在允许范围内',
        ipAddress,
        userAgent,
      });
      throw new ForbiddenException('IP地址不在允许范围内');
    }

    if (share.password) {
      if (!password) {
        return { share, needsPassword: true, visitor: null };
      }

      if (!this.sharesService.validatePassword(share, password)) {
        await this.logAccess({
          shareId: share.id,
          action: VisitorAction.PASSWORD_ATTEMPT,
          success: false,
          failureReason: '口令错误',
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('口令错误');
      }

      await this.logAccess({
        shareId: share.id,
        action: VisitorAction.PASSWORD_SUCCESS,
        success: true,
        ipAddress,
        userAgent,
      });
    }

    const visitor = await this.getOrCreateVisitor(ipAddress, userAgent);

    await this.logAccess({
      shareId: share.id,
      visitorId: visitor?.id,
      action: VisitorAction.ACCESS,
      success: true,
      ipAddress,
      userAgent,
      targetInfo: `${share.targetType}:${share.targetId}`,
    });

    await this.sharesService.incrementAccessCount(share.id);

    return { share, needsPassword: false, visitor };
  }

  async accessResource(
    token: string,
    password: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ share: Share; resource: any }> {
    const { share, needsPassword } = await this.verifyShare(token, password, ipAddress, userAgent);

    if (needsPassword) {
      throw new UnauthorizedException('需要访问口令');
    }

    const resource = await this.getResource(share);
    return { share, resource };
  }

  async downloadResource(
    token: string,
    password: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ share: Share; resource: any }> {
    const { share, needsPassword } = await this.verifyShare(token, password, ipAddress, userAgent);

    if (needsPassword) {
      throw new UnauthorizedException('需要访问口令');
    }

    if (!share.allowDownload) {
      await this.logAccess({
        shareId: share.id,
        action: VisitorAction.DOWNLOAD,
        success: false,
        failureReason: '该分享不允许下载',
        ipAddress,
        userAgent,
      });
      throw new ForbiddenException('该分享不允许下载');
    }

    const resource = await this.getResource(share);

    await this.logAccess({
      shareId: share.id,
      action: VisitorAction.DOWNLOAD,
      success: true,
      ipAddress,
      userAgent,
      targetInfo: `${share.targetType}:${share.targetId}`,
    });

    return { share, resource };
  }

  async getAccessLogs(shareId: number, operatorId: number): Promise<VisitorAccessLog[]> {
    const share = await this.shareRepo.findOne({ where: { id: shareId } });
    if (!share) throw new NotFoundException('分享链接不存在');

    const dramaIds = await this.getUserDramaIds(operatorId);
    if (!dramaIds.includes(share.dramaId)) {
      throw new ForbiddenException('无权限查看该分享的访问日志');
    }

    return this.accessLogRepo.find({
      where: { shareId },
      order: { createdAt: 'DESC' },
    });
  }

  async getShareStats(shareId: number, operatorId: number): Promise<{
    totalAccess: number;
    uniqueVisitors: number;
    downloadCount: number;
    failedAttempts: number;
  }> {
    const share = await this.shareRepo.findOne({ where: { id: shareId } });
    if (!share) throw new NotFoundException('分享链接不存在');

    const dramaIds = await this.getUserDramaIds(operatorId);
    if (!dramaIds.includes(share.dramaId)) {
      throw new ForbiddenException('无权限查看该分享的统计信息');
    }

    const [totalAccess, downloadCount, failedAttempts] = await Promise.all([
      this.accessLogRepo.count({ where: { shareId, action: VisitorAction.ACCESS, success: true } }),
      this.accessLogRepo.count({ where: { shareId, action: VisitorAction.DOWNLOAD, success: true } }),
      this.accessLogRepo.count({ where: { shareId, success: false } }),
    ]);

    const uniqueVisitors = await this.accessLogRepo
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.ipAddress)', 'count')
      .where('log.shareId = :shareId', { shareId })
      .andWhere('log.success = :success', { success: true })
      .getRawOne()
      .then((result) => parseInt(result.count, 10));

    return {
      totalAccess,
      uniqueVisitors,
      downloadCount,
      failedAttempts,
    };
  }

  private async getResource(share: Share): Promise<any> {
    switch (share.targetType) {
      case 'drama':
        return this.dramaRepo.findOne({ where: { id: share.targetId } });
      case 'script':
        return this.scriptRepo.findOne({ where: { id: share.targetId } });
      case 'role':
        return this.roleRepo.findOne({ where: { id: share.targetId } });
      case 'rehearsal':
        return this.rehearsalRepo.findOne({ where: { id: share.targetId } });
      case 'material':
        return this.materialRepo.findOne({ where: { id: share.targetId } });
      default:
        throw new NotFoundException('不支持的资源类型');
    }
  }

  private async getOrCreateVisitor(ipAddress: string, userAgent: string): Promise<Visitor | null> {
    const existing = await this.visitorRepo.findOne({
      where: { metadata: { ipAddress, userAgent } } as any,
    });
    if (existing) return existing;

    try {
      const visitor = this.visitorRepo.create({
        metadata: { ipAddress, userAgent },
      });
      return await this.visitorRepo.save(visitor);
    } catch {
      return null;
    }
  }

  private async logAccess(data: Partial<VisitorAccessLog>): Promise<void> {
    const log = this.accessLogRepo.create(data);
    await this.accessLogRepo.save(log).catch(() => {});
  }

  private async getUserDramaIds(userId: number): Promise<number[]> {
    const permissions = await this.permissionRepo.find({ where: { userId } });
    return permissions.map((p) => p.dramaId);
  }
}
