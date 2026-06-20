import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ActorProfilesService } from './actor-profiles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UserRole,
  ActorStatus,
  Weekday,
  AvailabilityType,
  HistoricalRoleStatus,
  LeaveStatus,
  ActorGender,
} from '../entities';

@Controller('actor-profiles')
@UseGuards(JwtAuthGuard)
export class ActorProfilesController {
  constructor(private service: ActorProfilesService) {}

  // ==================== Profile CRUD ====================

  @Get('statistics')
  getStatistics() {
    return this.service.getStatistics();
  }

  @Get()
  findAll(
    @Query('status') status?: ActorStatus,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.findAllProfiles({ status, keyword });
  }

  @Get('by-user/:userId')
  findByUserId(@Param('userId') userId: number) {
    return this.service.findProfileByUserId(Number(userId));
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOneProfile(Number(id));
  }

  @Get(':id/detail')
  getDetail(@Param('id') id: number) {
    return this.service.getProfileDetail(Number(id));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async create(
    @Body()
    body: {
      userId: number;
      realName?: string;
      stageName?: string;
      gender?: ActorGender;
      birthDate?: string;
      phone?: string;
      email?: string;
      status?: ActorStatus;
      address?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      skills?: string[];
      languages?: string[];
      heightCm?: number;
      weightKg?: number;
      avatarMaterialId?: number;
      materialIds?: number[];
      notes?: string;
    },
    @Request() req: any,
  ) {
    try {
      const data: any = { ...body };
      if (body.birthDate) data.birthDate = new Date(body.birthDate);
      return await this.service.createProfile(data, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async update(
    @Param('id') id: number,
    @Body()
    body: Partial<{
      realName: string;
      stageName: string;
      gender: ActorGender;
      birthDate: string;
      phone: string;
      email: string;
      status: ActorStatus;
      address: string;
      emergencyContact: string;
      emergencyPhone: string;
      skills: string[];
      languages: string[];
      heightCm: number;
      weightKg: number;
      avatarMaterialId: number;
      materialIds: number[];
      notes: string;
    }>,
    @Request() req: any,
  ) {
    try {
      const data: any = { ...body };
      if (body.birthDate) data.birthDate = new Date(body.birthDate);
      return await this.service.updateProfile(Number(id), data, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.removeProfile(Number(id), req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  // ==================== Rehearsal Availability ====================

  @Get(':id/availabilities')
  getAvailabilities(@Param('id') id: number) {
    return this.service.getAvailabilities(Number(id));
  }

  @Put(':id/availabilities')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateAvailabilities(
    @Param('id') id: number,
    @Body()
    body: Array<{
      weekday: Weekday;
      startTime?: string;
      endTime?: string;
      type?: AvailabilityType;
      note?: string;
    }>,
    @Request() req: any,
  ) {
    return this.service.updateAvailabilities(
      Number(id),
      body,
      req.user.userId,
      req.user.username,
    );
  }

  @Get(':id/availability-exceptions')
  getAvailabilityExceptions(
    @Param('id') id: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getAvailabilityExceptions(Number(id), startDate, endDate);
  }

  @Post(':id/availability-exceptions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  createAvailabilityException(
    @Param('id') id: number,
    @Body()
    body: {
      date: string;
      startTime?: string;
      endTime?: string;
      type?: AvailabilityType;
      reason?: string;
    },
    @Request() req: any,
  ) {
    return this.service.createAvailabilityException(
      Number(id),
      body,
      req.user.userId,
    );
  }

  @Put('availability-exceptions/:exceptionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateAvailabilityException(
    @Param('exceptionId') exceptionId: number,
    @Body()
    body: Partial<{
      date: string;
      startTime: string;
      endTime: string;
      type: AvailabilityType;
      reason: string;
    }>,
  ) {
    return this.service.updateAvailabilityException(Number(exceptionId), body);
  }

  @Delete('availability-exceptions/:exceptionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removeAvailabilityException(@Param('exceptionId') exceptionId: number) {
    return this.service.removeAvailabilityException(Number(exceptionId));
  }

  // ==================== Historical Roles ====================

  @Get(':id/historical-roles')
  getHistoricalRoles(@Param('id') id: number) {
    return this.service.getHistoricalRoles(Number(id));
  }

  @Post(':id/historical-roles')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  createHistoricalRole(
    @Param('id') id: number,
    @Body()
    body: {
      productionName: string;
      characterName: string;
      characterType?: string;
      startDate?: string;
      endDate?: string;
      venue?: string;
      director?: string;
      status?: HistoricalRoleStatus;
      materialIds?: number[];
      description?: string;
      review?: string;
      performanceCount?: number;
    },
    @Request() req: any,
  ) {
    return this.service.createHistoricalRole(
      Number(id),
      body,
      req.user.userId,
      req.user.username,
    );
  }

  @Put('historical-roles/:roleId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateHistoricalRole(
    @Param('roleId') roleId: number,
    @Body()
    body: Partial<{
      productionName: string;
      characterName: string;
      characterType: string;
      startDate: string;
      endDate: string;
      venue: string;
      director: string;
      status: HistoricalRoleStatus;
      materialIds: number[];
      description: string;
      review: string;
      performanceCount: number;
    }>,
    @Request() req: any,
  ) {
    return this.service.updateHistoricalRole(
      Number(roleId),
      body,
      req.user.userId,
      req.user.username,
    );
  }

  @Delete('historical-roles/:roleId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removeHistoricalRole(
    @Param('roleId') roleId: number,
    @Request() req: any,
  ) {
    return this.service.removeHistoricalRole(
      Number(roleId),
      req.user.userId,
      req.user.username,
    );
  }

  // ==================== Materials ====================

  @Get(':id/materials')
  getMaterials(@Param('id') id: number) {
    return this.service.getProfileMaterials(Number(id));
  }

  @Post(':id/materials/:materialId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  bindMaterial(
    @Param('id') id: number,
    @Param('materialId') materialId: number,
    @Request() req: any,
  ) {
    return this.service.bindMaterial(
      Number(id),
      Number(materialId),
      req.user.userId,
      req.user.username,
    );
  }

  @Delete(':id/materials/:materialId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  unbindMaterial(
    @Param('id') id: number,
    @Param('materialId') materialId: number,
    @Request() req: any,
  ) {
    return this.service.unbindMaterial(
      Number(id),
      Number(materialId),
      req.user.userId,
      req.user.username,
    );
  }

  // ==================== Leaves ====================

  @Get(':id/leaves')
  getLeaves(
    @Param('id') id: number,
    @Query('status') status?: LeaveStatus,
  ) {
    return this.service.getProfileLeaves(Number(id), status);
  }

  // ==================== Current Roles ====================

  @Get(':id/current-roles')
  getCurrentRoles(@Param('id') id: number) {
    return this.service.getProfileCurrentRoles(Number(id));
  }
}
