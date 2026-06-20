import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { RehearsalRoomsService } from './rehearsal-rooms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, RehearsalRoom, RoomStatus } from '../entities';

@Controller('rehearsal-rooms')
@UseGuards(JwtAuthGuard)
export class RehearsalRoomsController {
  constructor(private service: RehearsalRoomsService) {}

  @Get()
  findAll(@Query('status') status?: RoomStatus) {
    return this.service.findAll(status);
  }

  @Get('available')
  getAvailableRooms(
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('capacity') capacity?: number,
  ) {
    return this.service.getAvailableRooms(new Date(startTime), new Date(endTime), capacity);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/details')
  findOneWithDetails(@Param('id') id: number) {
    return this.service.findOneWithDetails(id);
  }

  @Get(':id/stats')
  getRoomUsageStats(
    @Param('id') id: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getRoomUsageStats(id, new Date(startDate), new Date(endDate));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  create(
    @Body()
    body: {
      name: string;
      description?: string;
      capacity?: number;
      facilities?: string[];
      area?: number;
      floor?: string;
      availableTimeSlots?: string[];
      status?: RoomStatus;
      notes?: string;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        createdBy: req.user.userId,
        facilities: body.facilities || [],
        availableTimeSlots: body.availableTimeSlots || [],
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
    @Body() body: Partial<RehearsalRoom>,
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
