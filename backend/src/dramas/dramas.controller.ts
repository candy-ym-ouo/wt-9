import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { DramasService } from './dramas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Drama, DramaStatus, DramaRole, UserRole } from '../entities';

@Controller('dramas')
@UseGuards(JwtAuthGuard)
export class DramasController {
  constructor(private service: DramasService) {}

  @Get()
  findAll(@Query('status') status: DramaStatus, @Request() req: any) {
    return this.service.findAll(req.user.userId, status);
  }

  @Get('search')
  searchDramas(@Query('q') query: string, @Request() req: any) {
    return this.service.searchDramas(query, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: number, @Request() req: any) {
    return this.service.getStats(id, req.user.userId);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: number, @Request() req: any) {
    return this.service.getPermissions(id, req.user.userId);
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      description?: string;
      synopsis?: string;
      genres?: string[];
      premiereDate?: Date;
      finalDate?: Date;
      venue?: string;
      status?: DramaStatus;
      tags?: string[];
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        tags: body.tags || [],
        genres: body.genres || [],
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() body: Partial<Drama>, @Request() req: any) {
    return this.service.update(id, body, req.user.userId, req.user.username);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }

  @Post(':id/permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  grantPermission(
    @Param('id') dramaId: number,
    @Body() body: { userId: number; role: DramaRole },
    @Request() req: any,
  ) {
    return this.service.updatePermission(
      dramaId,
      body.userId,
      body.role,
      req.user.userId,
      req.user.username,
    );
  }

  @Put(':id/permissions/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updatePermission(
    @Param('id') dramaId: number,
    @Param('userId') userId: number,
    @Body() body: { role: DramaRole },
    @Request() req: any,
  ) {
    return this.service.updatePermission(
      dramaId,
      userId,
      body.role,
      req.user.userId,
      req.user.username,
    );
  }

  @Delete(':id/permissions/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  revokePermission(
    @Param('id') dramaId: number,
    @Param('userId') userId: number,
    @Request() req: any,
  ) {
    return this.service.revokePermission(
      dramaId,
      userId,
      req.user.userId,
      req.user.username,
    );
  }
}
