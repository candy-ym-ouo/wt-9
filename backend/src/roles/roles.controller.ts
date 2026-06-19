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
    },
    @Request() req: any,
  ) {
    return this.service.create({ ...body, createdBy: req.user.userId, sceneNumbers: body.sceneNumbers || [] });
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(@Param('id') id: number, @Body() body: Partial<CastRole>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
