import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
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
  findAll(@Query('start') start?: string, @Query('end') end?: string) {
    if (start && end) {
      return this.service.findByDateRange(start, end);
    }
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
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      location?: string;
      participantIds?: number[];
    },
    @Request() req: any,
  ) {
    return this.service.create({
      ...body,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      createdBy: req.user.userId,
      participantIds: body.participantIds || [],
    });
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(@Param('id') id: number, @Body() body: Partial<Rehearsal>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
