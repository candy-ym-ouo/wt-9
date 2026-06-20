import { Controller, Get, Post, Param, Body, Request, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { VisitorAccessService } from './visitor-access.service';
import { SharesService } from './shares.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@Controller('visitor')
export class VisitorAccessController {
  constructor(
    private visitorAccessService: VisitorAccessService,
    private sharesService: SharesService,
  ) {}

  @Get('share/:token')
  async accessShare(
    @Param('token') token: string,
    @Query('password') password: string,
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await this.visitorAccessService.verifyShare(
      token,
      password,
      ipAddress,
      userAgent,
    );

    if (result.needsPassword) {
      throw new UnauthorizedException('需要访问口令');
    }

    const resource = await this.visitorAccessService.accessResource(
      token,
      password,
      ipAddress,
      userAgent,
    );

    return {
      share: {
        id: result.share.id,
        targetType: result.share.targetType,
        targetId: result.share.targetId,
        accessScope: result.share.accessScope,
        allowDownload: result.share.allowDownload,
        description: result.share.description,
      },
      resource: resource.resource,
    };
  }

  @Post('share/:token/verify')
  async verifyShare(
    @Param('token') token: string,
    @Body() body: { password?: string },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await this.visitorAccessService.verifyShare(
      token,
      body.password,
      ipAddress,
      userAgent,
    );

    if (result.needsPassword) {
      return {
        success: false,
        needsPassword: true,
        message: '需要访问口令',
      };
    }

    return {
      success: true,
      needsPassword: false,
      share: {
        id: result.share.id,
        targetType: result.share.targetType,
        targetId: result.share.targetId,
        accessScope: result.share.accessScope,
        allowDownload: result.share.allowDownload,
      },
    };
  }

  @Get('share/:token/download')
  async downloadResource(
    @Param('token') token: string,
    @Query('password') password: string,
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await this.visitorAccessService.downloadResource(
      token,
      password,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      share: {
        id: result.share.id,
        targetType: result.share.targetType,
        targetId: result.share.targetId,
      },
      resource: result.resource,
    };
  }

  @Get('shares/:id/logs')
  @UseGuards(JwtAuthGuard)
  getAccessLogs(@Param('id') shareId: number, @Request() req: any) {
    return this.visitorAccessService.getAccessLogs(shareId, req.user.userId);
  }

  @Get('shares/:id/stats')
  @UseGuards(JwtAuthGuard)
  getShareStats(@Param('id') shareId: number, @Request() req: any) {
    return this.visitorAccessService.getShareStats(shareId, req.user.userId);
  }
}
