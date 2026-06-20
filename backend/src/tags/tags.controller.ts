import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, TagCategory, TagTargetType } from '../entities';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private service: TagsService) {}

  @Get()
  findAll(
    @Query('dramaId') dramaId: number,
    @Query('category') category?: TagCategory,
    @Request() req?: any,
  ) {
    return this.service.findAll(dramaId, category, req.user.userId);
  }

  @Get('statistics')
  getStatistics(@Query('dramaId') dramaId?: number) {
    return this.service.getStatistics(dramaId);
  }

  @Get('targets/:tagId')
  getTargetsForTag(
    @Param('tagId') tagId: number,
    @Query('targetType') targetType?: TagTargetType,
  ) {
    return this.service.getTargetsForTag(tagId, targetType);
  }

  @Get('filter')
  async filterByTags(
    @Query('tagIds') tagIdsStr: string,
    @Query('targetType') targetType: TagTargetType,
    @Query('dramaId') dramaId?: number,
  ) {
    const tagIds = tagIdsStr.split(',').map(Number).filter(Boolean);
    const targetIds = await this.service.filterByTags(tagIds, targetType, dramaId);
    return { targetType, targetIds };
  }

  @Get(':targetType/:targetId')
  getTagsForTarget(
    @Param('targetType') targetType: TagTargetType,
    @Param('targetId') targetId: number,
  ) {
    return this.service.getTagsForTarget(targetType, Number(targetId));
  }

  @Get('detail/:id')
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
      color?: string;
      categories?: TagCategory[];
      dramaId?: number;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        categories: body.categories || [TagCategory.GENERAL],
      },
      req.user.userId,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(
    @Param('id') id: number,
    @Body() body: Partial<{ name: string; color: string; categories: TagCategory[] }>,
    @Request() req: any,
  ) {
    return this.service.update(id, body, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId);
  }

  @Post('attach')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  attachTags(
    @Body()
    body: {
      tagIds: number[];
      targetType: TagTargetType;
      targetId: number;
      dramaId?: number;
    },
    @Request() req: any,
  ) {
    return this.service.attachTags(
      body.tagIds,
      body.targetType,
      body.targetId,
      body.dramaId,
      req.user.userId,
    );
  }

  @Post('batch-attach')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  batchAttachTags(
    @Body()
    body: {
      items: Array<{ tagIds: number[]; targetType: TagTargetType; targetId: number }>;
      dramaId?: number;
    },
    @Request() req: any,
  ) {
    return this.service.batchAttachTags(body.items, body.dramaId, req.user.userId);
  }

  @Delete('detach')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  detachTag(
    @Body()
    body: {
      tagId: number;
      targetType: TagTargetType;
      targetId: number;
    },
    @Request() req: any,
  ) {
    return this.service.detachTag(body.tagId, body.targetType, body.targetId, req.user.userId);
  }
}
