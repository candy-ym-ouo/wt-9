import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { PermissionTemplatesService } from './permission-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, TemplateTargetScope, TemplateDramaRole } from '../entities';

@Controller('permission-templates')
@UseGuards(JwtAuthGuard)
export class PermissionTemplatesController {
  constructor(private service: PermissionTemplatesService) {}

  @Get()
  findAll(
    @Query('targetScope') targetScope: TemplateTargetScope,
    @Query('dramaId') dramaId: number,
    @Request() req: any,
  ) {
    return this.service.findAll(req.user.userId, targetScope, dramaId);
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
      name: string;
      description?: string;
      targetScope: TemplateTargetScope;
      dramaRole: TemplateDramaRole;
      menus: string[];
      operations: string[];
      dramaId?: number;
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
    body: Partial<{
      name: string;
      description: string;
      menus: string[];
      operations: string[];
    }>,
    @Request() req: any,
  ) {
    return this.service.update(id, body, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }

  @Post(':id/apply/drama')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  applyToDrama(
    @Param('id') templateId: number,
    @Body() body: { dramaId: number; userIds: number[] },
    @Request() req: any,
  ) {
    return this.service.applyToDrama(
      templateId,
      body.dramaId,
      body.userIds,
      req.user.userId,
      req.user.username,
    );
  }

  @Post(':id/apply/team')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  applyToTeam(
    @Param('id') templateId: number,
    @Body() body: { dramaIds: number[] },
    @Request() req: any,
  ) {
    return this.service.applyToTeam(
      templateId,
      body.dramaIds,
      req.user.userId,
      req.user.username,
    );
  }
}
