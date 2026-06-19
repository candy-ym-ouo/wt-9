import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.usersService.findOne(id);
  }

  @Put(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateRole(@Param('id') id: number, @Body() body: { role: UserRole }) {
    return this.usersService.updateRole(id, body.role);
  }

  @Put(':id/freeze')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  freeze(@Param('id') id: number, @Request() req: any) {
    return this.usersService.freeze(id, req.user.userId, req.user.username);
  }

  @Put(':id/unfreeze')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  unfreeze(@Param('id') id: number, @Request() req: any) {
    return this.usersService.unfreeze(id, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: number) {
    return this.usersService.remove(id);
  }
}
