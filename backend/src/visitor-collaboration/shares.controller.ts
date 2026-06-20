import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { SharesService } from './shares.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, ShareTargetType, AccessScope } from '../entities';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  constructor(private service: SharesService) {}

  @Get()
  findAll(@Query('dramaId') dramaId: number, @Request() req: any) {
    return this.service.findAll(dramaId, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  create(
    @Body()
    body: {
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
    @Request() req: any,
  ) {
    return this.service.create(body, req.user.userId, req.user.username);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(
    @Param('id') id: number,
    @Body()
    body: {
      accessScope?: AccessScope;
      allowDownload?: boolean;
      password?: string;
      expiresAt?: Date;
      maxAccessCount?: number;
      allowedIpRanges?: string[];
      description?: string;
    },
    @Request() req: any,
  ) {
    return this.service.update(id, body, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  revoke(@Param('id') id: number, @Request() req: any) {
    return this.service.revoke(id, req.user.userId, req.user.username);
  }

  @Post(':id/extend')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  extend(
    @Param('id') id: number,
    @Body() body: { expiresAt: Date },
    @Request() req: any,
  ) {
    return this.service.extend(id, body.expiresAt, req.user.userId, req.user.username);
  }
}
