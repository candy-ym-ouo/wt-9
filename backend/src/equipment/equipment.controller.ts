import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Equipment, EquipmentStatus } from '../entities';

@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private service: EquipmentService) {}

  @Get()
  findAll(
    @Query('status') status?: EquipmentStatus,
    @Query('category') category?: string,
    @Query('roomId') roomId?: number,
  ) {
    return this.service.findAll(status, category, roomId);
  }

  @Get('available')
  getAvailableEquipment(
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('category') category?: string,
  ) {
    return this.service.getAvailableEquipment(new Date(startTime), new Date(endTime), category);
  }

  @Get('stats')
  getEquipmentStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getEquipmentStats(new Date(startDate), new Date(endDate));
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
      name: string;
      code?: string;
      description?: string;
      category: string;
      specification?: string;
      brand?: string;
      purchaseDate?: Date;
      price?: number;
      roomId?: number;
      status?: EquipmentStatus;
      maintenanceRecords?: string;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        createdBy: req.user.userId,
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(
    @Param('id') id: number,
    @Body() body: Partial<Equipment>,
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
}
