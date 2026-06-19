import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { RehearsalsService } from './rehearsals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Rehearsal } from '../entities';

@Controller('rehearsals')
@UseGuards(JwtAuthGuard)
export class RehearsalsController {
  constructor(private service: RehearsalsService) {}

  @Get()
  async findAll(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('location') location?: string,
    @Query('participantId') participantId?: string,
    @Query('timeSlot') timeSlot?: string,
    @Query('attendanceStatus') attendanceStatus?: string,
  ) {
    const hasFilters = location || participantId || timeSlot || attendanceStatus;
    let rehearsals: Rehearsal[];
    if (hasFilters || (start && end)) {
      rehearsals = await this.service.findWithFilters({ start, end, location, participantId, timeSlot, attendanceStatus });
    } else {
      rehearsals = await this.service.findAll();
    }
    const withConflicts = await this.service.enrichWithConflictInfo(rehearsals);
    const withParticipants = await this.service.enrichWithParticipantInfo(rehearsals);
    return withConflicts.map((r, i) => ({ ...r, ...withParticipants[i] }));
  }

  @Get('statistics/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getStatistics(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.service.getStatistics(start, end);
  }

  @Post('check-conflicts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  checkConflicts(
    @Body()
    body: {
      startTime: string;
      endTime: string;
      participantIds?: number[];
      excludeId?: number;
    },
  ) {
    return this.service.checkConflicts(
      new Date(body.startTime),
      new Date(body.endTime),
      body.participantIds || [],
      body.excludeId,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      location?: string;
      participantIds?: number[];
      materialIds?: number[];
    },
    @Request() req: any,
  ) {
    try {
      return await this.service.create({
        ...body,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        createdBy: req.user.userId,
        participantIds: body.participantIds || [],
        materialIds: body.materialIds || [],
      });
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOneWithDetails(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async update(
    @Param('id') id: number,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      location: string;
      participantIds: number[];
      materialIds: number[];
    }>,
  ) {
    try {
      const data: any = { ...body };
      if (body.startTime) data.startTime = new Date(body.startTime);
      if (body.endTime) data.endTime = new Date(body.endTime);
      return await this.service.update(id, data);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id/attendance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async updateAttendance(
    @Param('id') id: number,
    @Body()
    body: {
      updates: Array<{
        userId: number;
        status: 'present' | 'absent' | 'late' | null;
        absentReason?: string;
      }>;
    },
  ) {
    return this.service.updateAttendance(id, body.updates);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
