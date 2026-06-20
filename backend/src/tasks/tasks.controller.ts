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
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UserRole,
  Task,
  TaskCategory,
  TaskStatus,
  TaskPriority,
} from '../entities';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private service: TasksService) {}

  @Get()
  findAll(
    @Query('category') category?: TaskCategory,
    @Query('status') status?: TaskStatus,
    @Query('priority') priority?: TaskPriority,
    @Query('assigneeId') assigneeId?: string,
    @Query('assignerId') assignerId?: string,
    @Query('createdBy') createdBy?: string,
    @Query('rehearsalId') rehearsalId?: string,
    @Query('roleId') roleId?: string,
    @Query('materialId') materialId?: string,
    @Query('performanceId') performanceId?: string,
    @Query('keyword') keyword?: string,
    @Query('tags') tags?: string,
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
    @Query('includeFollowerOf') includeFollowerOf?: string,
  ) {
    return this.service.findAll({
      category,
      status,
      priority,
      assigneeId: assigneeId !== undefined ? parseInt(assigneeId, 10) : undefined,
      assignerId: assignerId !== undefined ? parseInt(assignerId, 10) : undefined,
      createdBy: createdBy !== undefined ? parseInt(createdBy, 10) : undefined,
      rehearsalId: rehearsalId !== undefined ? parseInt(rehearsalId, 10) : undefined,
      roleId: roleId !== undefined ? parseInt(roleId, 10) : undefined,
      materialId: materialId !== undefined ? parseInt(materialId, 10) : undefined,
      performanceId: performanceId !== undefined ? parseInt(performanceId, 10) : undefined,
      keyword,
      tags,
      dueFrom,
      dueTo,
      includeFollowerOf: includeFollowerOf !== undefined ? parseInt(includeFollowerOf, 10) : undefined,
    });
  }

  @Get('stats')
  getStats(@Query('userId') userId?: string, @Request() req?: any) {
    const uid = userId !== undefined ? parseInt(userId, 10) : req?.user?.userId;
    return this.service.getStats(uid);
  }

  @Get('meta/categories')
  getCategories() {
    return [
      { value: TaskCategory.PREPARATION, label: '排练前准备' },
      { value: TaskCategory.MATERIAL_FILL, label: '素材补齐' },
      { value: TaskCategory.ROLE_CONFIRMATION, label: '角色确认' },
      { value: TaskCategory.OTHER, label: '其他' },
    ];
  }

  @Get('meta/statuses')
  getStatuses() {
    return [
      { value: TaskStatus.PENDING, label: '待处理' },
      { value: TaskStatus.ASSIGNED, label: '已指派' },
      { value: TaskStatus.IN_PROGRESS, label: '进行中' },
      { value: TaskStatus.REVIEW, label: '待审核' },
      { value: TaskStatus.COMPLETED, label: '已完成' },
      { value: TaskStatus.CANCELLED, label: '已取消' },
    ];
  }

  @Get('meta/priorities')
  getPriorities() {
    return [
      { value: TaskPriority.LOW, label: '低' },
      { value: TaskPriority.MEDIUM, label: '中' },
      { value: TaskPriority.HIGH, label: '高' },
      { value: TaskPriority.URGENT, label: '紧急' },
    ];
  }

  @Get('rehearsal/:rehearsalId')
  getByRehearsal(@Param('rehearsalId') rehearsalId: number) {
    return this.service.getByRehearsal(rehearsalId);
  }

  @Get('role/:roleId')
  getByRole(@Param('roleId') roleId: number) {
    return this.service.getByRole(roleId);
  }

  @Get('material/:materialId')
  getByMaterial(@Param('materialId') materialId: number) {
    return this.service.getByMaterial(materialId);
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
      category?: TaskCategory;
      status?: TaskStatus;
      priority?: TaskPriority;
      rehearsalId?: number;
      roleId?: number;
      materialId?: number;
      performanceId?: number;
      relatedMaterialIds?: number[];
      relatedRoleIds?: number[];
      assigneeId?: number;
      followerIds?: number[];
      dueDate?: string;
      tags?: string[];
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        createdBy: req.user.userId,
        assignerId: req.user.userId,
        followerIds: body.followerIds || [],
        relatedMaterialIds: body.relatedMaterialIds || [],
        relatedRoleIds: body.relatedRoleIds || [],
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        tags: body.tags || [],
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
    @Body()
    body: Partial<Task> & {
      dueDate?: string;
    },
    @Request() req: any,
  ) {
    const { dueDate, ...rest } = body;
    return this.service.update(
      id,
      {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: number,
    @Body() body: { status: TaskStatus; remark?: string },
    @Request() req: any,
  ) {
    return this.service.updateStatus(
      id,
      body.status,
      req.user.userId,
      req.user.username,
      body.remark,
    );
  }

  @Put(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  assign(
    @Param('id') id: number,
    @Body() body: { assigneeId: number },
    @Request() req: any,
  ) {
    return this.service.assign(
      id,
      body.assigneeId,
      req.user.userId,
      req.user.username,
    );
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: number,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.service.addComment(
      id,
      body.content,
      req.user.userId,
      req.user.username,
    );
  }

  @Post(':id/followers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  addFollower(
    @Param('id') id: number,
    @Body() body: { followerId: number },
    @Request() req: any,
  ) {
    return this.service.addFollower(
      id,
      body.followerId,
      req.user.userId,
      req.user.username,
    );
  }

  @Delete(':id/followers/:followerId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removeFollower(
    @Param('id') id: number,
    @Param('followerId') followerId: number,
    @Request() req: any,
  ) {
    return this.service.removeFollower(
      id,
      followerId,
      req.user.userId,
      req.user.username,
    );
  }

  @Put('batch/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  batchUpdateStatus(
    @Body() body: { ids: number[]; status: TaskStatus; remark?: string },
    @Request() req: any,
  ) {
    return this.service.batchUpdateStatus(
      body.ids,
      body.status,
      req.user.userId,
      req.user.username,
      body.remark,
    );
  }

  @Put('batch/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  batchAssign(
    @Body() body: { ids: number[]; assigneeId: number },
    @Request() req: any,
  ) {
    return this.service.batchAssign(
      body.ids,
      body.assigneeId,
      req.user.userId,
      req.user.username,
    );
  }
}
