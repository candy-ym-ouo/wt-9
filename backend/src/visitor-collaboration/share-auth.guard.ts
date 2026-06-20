import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SharesService } from './shares.service';

@Injectable()
export class ShareAuthGuard implements CanActivate {
  constructor(private sharesService: SharesService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.params.token || request.query.token || request.headers['x-share-token'];
    const password = request.body?.password || request.query.password || request.headers['x-share-password'];
    const ipAddress = request.ip || request.connection?.remoteAddress || request.headers['x-forwarded-for'];
    const userAgent = request.headers['user-agent'];

    return this.validateShare(token, password, ipAddress, userAgent, request);
  }

  private async validateShare(
    token: string | undefined,
    password: string | undefined,
    ipAddress: string | undefined,
    userAgent: string | undefined,
    request: any,
  ): Promise<boolean> {
    if (!token) {
      throw new UnauthorizedException('缺少分享令牌');
    }

    const share = await this.sharesService.findByToken(token);
    if (!share) {
      throw new ForbiddenException('分享链接不存在或已失效');
    }

    if (!this.sharesService.validateAccessCount(share)) {
      throw new ForbiddenException('访问次数已达上限');
    }

    if (!this.sharesService.validateIp(share, ipAddress || '0.0.0.0')) {
      throw new ForbiddenException('IP地址不在允许范围内');
    }

    if (share.password) {
      if (!password) {
        request.needsPassword = true;
        return true;
      }
      if (!this.sharesService.validatePassword(share, password)) {
        throw new UnauthorizedException('口令错误');
      }
    }

    request.share = share;
    request.ipAddress = ipAddress;
    request.userAgent = userAgent;
    return true;
  }
}
