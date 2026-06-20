import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { RoomReservationsService } from './room-reservations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, ReservationStatus, ReservationPurpose } from '../entities';

@Controller('room-reservations')
@UseGuards(JwtAuthGuard)
export class RoomReservationsController {
  constructor(private service: RoomReservationsService) {}

  @Get()
  findAll(
    @Query('roomId') roomId?: number,
    @Query('status') status?: ReservationStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('userId') userId?: number,
  ) {
    return this.service.findAll(
      roomId,
      status,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
      userId,
    );
  }

  @Get('my')
  getMyReservations(
    @Request() req: any,
    @Query('status') status?: ReservationStatus,
  ) {
    return this.service.getMyReservations(req.user.userId, status);
  }

  @Get('upcoming')
  getUpcomingReservations(
    @Query('roomId') roomId?: number,
    @Query('limit') limit: number = 10,
  ) {
    return this.service.getUpcomingReservations(roomId, limit);
  }

  @Get('daily')
  getDailyReservations(
    @Query('date') date: string,
    @Query('roomId') roomId?: number,
  ) {
    return this.service.getDailyReservations(new Date(date), roomId);
  }

  @Get('stats')
  getUsageStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getUsageStatistics(new Date(startDate), new Date(endDate));
  }

  @Get('check-conflicts')
  checkConflicts(
    @Query('roomId') roomId: number,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('equipmentIds') equipmentIds?: string,
    @Query('participantCount') participantCount?: number,
  ) {
    const ids = equipmentIds ? equipmentIds.split(',').map(Number) : [];
    return this.service.checkConflicts(
      roomId,
      new Date(startTime),
      new Date(endTime),
      ids,
      participantCount,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      roomId: number;
      startTime: string;
      endTime: string;
      reserverName: string;
      reserverPhone?: string;
      purpose: ReservationPurpose;
      purposeDetail?: string;
      participantIds?: number[];
      participantCount?: number;
      equipmentIds?: number[];
      remarks?: string;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Post('check-conflicts')
  checkConflictsPost(
    @Body()
    body: {
      roomId: number;
      startTime: string;
      endTime: string;
      equipmentIds?: number[];
      participantCount?: number;
      excludeReservationId?: number;
    },
  ) {
    return this.service.checkConflicts(
      body.roomId,
      new Date(body.startTime),
      new Date(body.endTime),
      body.equipmentIds || [],
      body.participantCount,
      body.excludeReservationId,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() body: any,
    @Request() req: any,
  ) {
    const updateData = { ...body };
    if (body.startTime) updateData.startTime = new Date(body.startTime);
    if (body.endTime) updateData.endTime = new Date(body.endTime);
    return this.service.update(id, updateData, req.user.userId, req.user.username);
  }

  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  approve(
    @Param('id') id: number,
    @Request() req: any,
  ) {
    return this.service.approve(id, req.user.userId, req.user.username);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  reject(
    @Param('id') id: number,
    @Body() body: { rejectReason: string },
    @Request() req: any,
  ) {
    return this.service.reject(id, body.rejectReason, req.user.userId, req.user.username);
  }

  @Put(':id/cancel')
  cancel(
    @Param('id') id: number,
    @Request() req: any,
  ) {
    return this.service.cancel(id, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }
}
