import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, CastRole } from '../entities';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private service: RolesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/rehearsals')
  getRoleRehearsals(@Param('id') id: number) {
    return this.service.getRoleRehearsals(id);
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
