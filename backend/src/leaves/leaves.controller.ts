import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, LeaveStatus, LeaveType } from '../entities';

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private service: LeavesService) {}

  @Get()
  findAll(
    @Query('actorId') actorId?: string,
    @Query('status') status?: LeaveStatus,
    @Query('roleId') roleId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll({
      actorId: actorId ? Number(actorId) : undefined,
      status,
      roleId: roleId ? Number(roleId) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('statistics')
  getStatistics() {
    return this.service.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Post()
  async create(
    @Body()
    body: {
      type: LeaveType;
      reason?: string;
      startDate: string;
      endDate: string;
      roleId?: number;
      substituteActorId?: number;
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.create(
        {
          type: body.type,
          reason: body.reason,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          roleId: body.roleId,
          substituteActorId: body.substituteActorId,
        },
        req.user.userId,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body()
    body: Partial<{
      type: LeaveType;
      reason: string;
      startDate: string;
      endDate: string;
      roleId: number;
      substituteActorId: number;
    }>,
  ) {
    try {
      const data: any = { ...body };
      if (body.startDate) data.startDate = new Date(body.startDate);
      if (body.endDate) data.endDate = new Date(body.endDate);
      return await this.service.update(id, data);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async approve(
    @Param('id') id: number,
    @Body() body: { substituteActorId?: number },
    @Request() req: any,
  ) {
    try {
      return await this.service.approve(id, body.substituteActorId, req.user.userId);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async reject(
    @Param('id') id: number,
    @Body() body: { rejectionReason: string },
    @Request() req: any,
  ) {
    try {
      return await this.service.reject(id, body.rejectionReason, req.user.userId);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
