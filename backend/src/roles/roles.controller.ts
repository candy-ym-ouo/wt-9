import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, CastRole, TagTargetType } from '../entities';
import { TagsService } from '../tags/tags.service';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private service: RolesService, private tagsService: TagsService) {}

  @Get(':id/tags')
  getRoleTags(@Param('id') id: number) {
    return this.tagsService.getTagsForTarget(TagTargetType.ROLE, id);
  }

  @Get()
  findAll(@Query('dramaId') dramaId: number, @Request() req: any) {
    return this.service.findAll(dramaId, req.user.userId);
  }

  @Get('cross-drama')
  findAllCrossDrama(@Request() req: any) {
    return this.service.findAllCrossDrama(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOne(id, req.user.userId);
  }

  @Get(':id/rehearsals')
  getRoleRehearsals(@Param('id') id: number, @Request() req: any) {
    return this.service.getRoleRehearsals(id, req.user.userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  create(
    @Body()
    body: {
      characterName: string;
      characterDescription?: string;
      actorId?: number;
      sceneNumbers?: number[];
      priority?: number;
      substituteActorIds?: number[];
      dramaId: number;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        createdBy: req.user.userId,
        sceneNumbers: body.sceneNumbers || [],
        substituteActorIds: body.substituteActorIds || [],
      },
      body.dramaId,
      req.user.userId,
      req.user.username,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(@Param('id') id: number, @Body() body: Partial<CastRole>, @Request() req: any) {
    return this.service.update(id, body, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }

  @Post(':id/substitutes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  addSubstitute(
    @Param('id') roleId: number,
    @Body() body: { actorId: number },
    @Request() req: any,
  ) {
    return this.service.addSubstitute(roleId, body.actorId, req.user.userId, req.user.username);
  }

  @Delete(':id/substitutes/:actorId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removeSubstitute(
    @Param('id') roleId: number,
    @Param('actorId') actorId: number,
    @Request() req: any,
  ) {
    return this.service.removeSubstitute(roleId, actorId, req.user.userId, req.user.username);
  }

  @Put('priorities/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updatePriorities(
    @Body() body: { updates: Array<{ id: number; priority: number }> },
    @Request() req: any,
  ) {
    return this.service.updatePriorities(body.updates, req.user.userId, req.user.username);
  }
}
