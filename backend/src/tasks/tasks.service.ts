import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, Between } from 'typeorm';
import {
  Task,
  TaskCategory,
  TaskStatus,
  TaskPriority,
  User,
  CastRole,
  Rehearsal,
  Material,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

interface SearchFilters {
  category?: TaskCategory;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: number;
  assignerId?: number;
  createdBy?: number;
  rehearsalId?: number;
  roleId?: number;
  materialId?: number;
  performanceId?: number;
  keyword?: string;
  tags?: string;
  dueFrom?: string;
  dueTo?: string;
  includeFollowerOf?: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private repo: Repository<Task>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    data: Partial<Task>,
    operatorId: number,
    operatorName: string,
  ) {
    const task = this.repo.create({
      ...data,
      status: data.status || TaskStatus.PENDING,
      statusHistory: data.status
        ? [
            {
              id: Date.now(),
              fromStatus: null,
              toStatus: data.status,
              userId: operatorId,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    });

    const saved = await this.repo.save(task);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_TASK,
      module: AuditModule.TASK,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'task',
      targetUserId: saved.assigneeId,
      detail: `创建任务「${saved.title}」`,
      metadata: {
        title: saved.title,
        category: saved.category,
        priority: saved.priority,
        assigneeId: saved.assigneeId,
      },
    });

    if (saved.assigneeId) {
      await this.auditLogsService.log({
        action: AuditAction.ASSIGN_TASK,
        module: AuditModule.TASK,
        operatorId,
        operatorName,
        targetId: saved.id,
        targetType: 'task',
        targetUserId: saved.assigneeId,
        detail: `指派任务「${saved.title}」给用户 #${saved.assigneeId}`,
        metadata: { taskId: saved.id, assigneeId: saved.assigneeId },
      });
    }

    return this.findOne(saved.id);
  }

  async findAll(filters: SearchFilters = {}) {
    const query = this.buildQuery(filters);
    const tasks = await query
      .orderBy({
        'task.priority': 'DESC',
        'task.dueDate': 'ASC',
        'task.createdAt': 'DESC',
      })
      .getMany();
    return this.enrichAll(tasks);
  }

  async findOne(id: number) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) return null;
    const enriched = await this.enrichAll([task]);
    return enriched[0];
  }

  async update(
    id: number,
    data: Partial<Task>,
    operatorId: number,
    operatorName: string,
  ) {
    const old = await this.repo.findOne({ where: { id } });
    if (!old) return null;

    const changes: string[] = [];
    if (data.title && data.title !== old.title) {
      changes.push(`标题: ${old.title} → ${data.title}`);
    }
    if (data.category && data.category !== old.category) {
      changes.push(`类别: ${old.category} → ${data.category}`);
    }
    if (data.priority && data.priority !== old.priority) {
      changes.push(`优先级: ${old.priority} → ${data.priority}`);
    }
    if (data.assigneeId !== undefined && data.assigneeId !== old.assigneeId) {
      const oldAssignee = old.assigneeId
        ? await this.userRepo.findOne({ where: { id: old.assigneeId } })
        : null;
      const newAssignee = data.assigneeId
        ? await this.userRepo.findOne({ where: { id: data.assigneeId } })
        : null;
      changes.push(
        `负责人: ${oldAssignee?.displayName || oldAssignee?.username || '无'} → ${newAssignee?.displayName || newAssignee?.username || '无'}`,
      );
    }
    if (data.dueDate !== undefined && data.dueDate?.getTime() !== old.dueDate?.getTime()) {
      changes.push(
        `截止日期: ${old.dueDate ? old.dueDate.toISOString().slice(0, 10) : '无'} → ${data.dueDate ? data.dueDate.toISOString().slice(0, 10) : '无'}`,
      );
    }

    await this.repo.update(id, data);
    const updated = await this.findOne(id);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_TASK,
      module: AuditModule.TASK,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'task',
      targetUserId: data.assigneeId,
      detail:
        changes.length > 0
          ? `更新任务「${old.title}」: ${changes.join('; ')}`
          : `更新任务「${old.title}」`,
      metadata: { old, new: data },
    });

    if (
      data.assigneeId !== undefined &&
      data.assigneeId !== old.assigneeId &&
      data.assigneeId
    ) {
      await this.auditLogsService.log({
        action: AuditAction.ASSIGN_TASK,
        module: AuditModule.TASK,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'task',
        targetUserId: data.assigneeId,
        detail: `重新指派任务「${old.title}」给用户 #${data.assigneeId}`,
        metadata: {
          taskId: id,
          oldAssigneeId: old.assigneeId,
          newAssigneeId: data.assigneeId,
        },
      });
    }

    return updated;
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const task = await this.repo.findOne({ where: { id } });
    if (task) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_TASK,
        module: AuditModule.TASK,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'task',
        detail: `删除任务「${task.title}」`,
        metadata: { title: task.title, category: task.category },
      });
    }
    return this.repo.delete(id);
  }

  async updateStatus(
    id: number,
    newStatus: TaskStatus,
    operatorId: number,
    operatorName: string,
    remark?: string,
  ) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) return null;

    const oldStatus = task.status;
    const history = task.statusHistory || [];
    history.push({
      id: Date.now(),
      fromStatus: oldStatus,
      toStatus: newStatus,
      userId: operatorId,
      remark,
      createdAt: new Date().toISOString(),
    });

    const updates: Partial<Task> = {
      status: newStatus,
      statusHistory: history,
    };

    if (
      newStatus === TaskStatus.IN_PROGRESS &&
      oldStatus !== TaskStatus.IN_PROGRESS
    ) {
      updates.startedAt = new Date();
    }
    if (
      newStatus === TaskStatus.COMPLETED &&
      oldStatus !== TaskStatus.COMPLETED
    ) {
      updates.completedAt = new Date();
    }
    if (newStatus === TaskStatus.ASSIGNED && !task.assigneeId) {
      updates.assigneeId = operatorId;
    }

    await this.repo.update(id, updates);

    const statusLabel: Record<TaskStatus, string> = {
      [TaskStatus.PENDING]: '待处理',
      [TaskStatus.ASSIGNED]: '已指派',
      [TaskStatus.IN_PROGRESS]: '进行中',
      [TaskStatus.REVIEW]: '待审核',
      [TaskStatus.COMPLETED]: '已完成',
      [TaskStatus.CANCELLED]: '已取消',
    };

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_TASK_STATUS,
      module: AuditModule.TASK,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'task',
      targetUserId: task.assigneeId,
      detail: `任务「${task.title}」状态变更: ${statusLabel[oldStatus]} → ${statusLabel[newStatus]}${remark ? ` (${remark})` : ''}`,
      metadata: {
        taskId: id,
        fromStatus: oldStatus,
        toStatus: newStatus,
        remark,
      },
    });

    return this.findOne(id);
  }

  async assign(
    id: number,
    assigneeId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) return null;

    const newStatus =
      task.status === TaskStatus.PENDING ? TaskStatus.ASSIGNED : task.status;
    const history = task.statusHistory || [];

    if (newStatus !== task.status) {
      history.push({
        id: Date.now(),
        fromStatus: task.status,
        toStatus: newStatus,
        userId: operatorId,
        createdAt: new Date().toISOString(),
      });
    }

    await this.repo.update(id, {
      assigneeId,
      assignerId: operatorId,
      status: newStatus,
      statusHistory: history,
    });

    const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });

    await this.auditLogsService.log({
      action: AuditAction.ASSIGN_TASK,
      module: AuditModule.TASK,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'task',
      targetUserId: assigneeId,
      targetUsername: assignee?.username,
      detail: `指派任务「${task.title}」给 ${assignee?.displayName || assignee?.username || `#${assigneeId}`}`,
      metadata: { taskId: id, assigneeId },
    });

    return this.findOne(id);
  }

  async addComment(
    id: number,
    content: string,
    operatorId: number,
    operatorName: string,
  ) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) return null;

    const comments = task.comments || [];
    comments.push({
      id: Date.now(),
      userId: operatorId,
      content,
      createdAt: new Date().toISOString(),
    });

    await this.repo.update(id, { comments });

    await this.auditLogsService.log({
      action: AuditAction.ADD_TASK_COMMENT,
      module: AuditModule.TASK,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'task',
      targetUserId: task.assigneeId,
      detail: `在任务「${task.title}」中添加评论`,
      metadata: { taskId: id, content },
    });

    return this.findOne(id);
  }

  async addFollower(
    id: number,
    followerId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) return null;

    const followers = task.followerIds || [];
    if (!followers.includes(followerId)) {
      followers.push(followerId);
      await this.repo.update(id, { followerIds: followers });

      const follower = await this.userRepo.findOne({
        where: { id: followerId },
      });

      await this.auditLogsService.log({
        action: AuditAction.ADD_TASK_FOLLOWER,
        module: AuditModule.TASK,
        operatorId,
        operatorName,
        targetId: id,
        targetType: 'task',
        targetUserId: followerId,
        detail: `为任务「${task.title}」添加关注人 ${follower?.displayName || follower?.username || `#${followerId}`}`,
        metadata: { taskId: id, followerId },
      });
    }

    return this.findOne(id);
  }

  async removeFollower(
    id: number,
    followerId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) return null;

    const followers = (task.followerIds || []).filter((f) => f !== followerId);
    await this.repo.update(id, { followerIds: followers });

    const follower = await this.userRepo.findOne({ where: { id: followerId } });

    await this.auditLogsService.log({
      action: AuditAction.REMOVE_TASK_FOLLOWER,
      module: AuditModule.TASK,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'task',
      targetUserId: followerId,
      detail: `为任务「${task.title}」移除关注人 ${follower?.displayName || follower?.username || `#${followerId}`}`,
      metadata: { taskId: id, followerId },
    });

    return this.findOne(id);
  }

  async getStats(userId?: number) {
    const baseQb = this.repo.createQueryBuilder('task');
    if (userId) {
      baseQb.where('task.assigneeId = :userId OR task.createdBy = :userId', {
        userId,
      });
    }

    const total = await baseQb.getCount();

    const statusCounts = await this.repo
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(userId ? 'task.assigneeId = :userId OR task.createdBy = :userId' : '1=1', { userId })
      .groupBy('task.status')
      .getRawMany();

    const categoryCounts = await this.repo
      .createQueryBuilder('task')
      .select('task.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where(userId ? 'task.assigneeId = :userId OR task.createdBy = :userId' : '1=1', { userId })
      .groupBy('task.category')
      .getRawMany();

    const priorityCounts = await this.repo
      .createQueryBuilder('task')
      .select('task.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where(userId ? 'task.assigneeId = :userId OR task.createdBy = :userId' : '1=1', { userId })
      .groupBy('task.priority')
      .getRawMany();

    const now = new Date();
    const overdue = await this.repo
      .createQueryBuilder('task')
      .where('task.dueDate < :now AND task.status NOT IN (:...completedStatuses)', {
        now,
        completedStatuses: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
      })
      .andWhere(userId ? '(task.assigneeId = :userId OR task.createdBy = :userId)' : '1=1', { userId })
      .getCount();

    return {
      total,
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: parseInt(s.count, 10),
      })),
      categoryCounts: categoryCounts.map((c) => ({
        category: c.category,
        count: parseInt(c.count, 10),
      })),
      priorityCounts: priorityCounts.map((p) => ({
        priority: p.priority,
        count: parseInt(p.count, 10),
      })),
      overdue,
    };
  }

  async getByRehearsal(rehearsalId: number) {
    const tasks = await this.repo.find({
      where: { rehearsalId },
      order: { priority: 'DESC', dueDate: 'ASC', createdAt: 'DESC' },
    });
    return this.enrichAll(tasks);
  }

  async getByRole(roleId: number) {
    const tasks = await this.repo
      .createQueryBuilder('task')
      .where('task.roleId = :roleId OR JSON_EXTRACT(task.relatedRoleIds, "$") LIKE :rolePattern', {
        roleId,
        rolePattern: `%${roleId}%`,
      })
      .orderBy({
        'task.priority': 'DESC',
        'task.dueDate': 'ASC',
        'task.createdAt': 'DESC',
      })
      .getMany();
    return this.enrichAll(tasks);
  }

  async getByMaterial(materialId: number) {
    const tasks = await this.repo
      .createQueryBuilder('task')
      .where('task.materialId = :materialId OR JSON_EXTRACT(task.relatedMaterialIds, "$") LIKE :materialPattern', {
        materialId,
        materialPattern: `%${materialId}%`,
      })
      .orderBy({
        'task.priority': 'DESC',
        'task.dueDate': 'ASC',
        'task.createdAt': 'DESC',
      })
      .getMany();
    return this.enrichAll(tasks);
  }

  async batchUpdateStatus(
    ids: number[],
    newStatus: TaskStatus,
    operatorId: number,
    operatorName: string,
    remark?: string,
  ) {
    const results = await Promise.all(
      ids.map((id) =>
        this.updateStatus(id, newStatus, operatorId, operatorName, remark),
      ),
    );
    return results.filter(Boolean);
  }

  async batchAssign(
    ids: number[],
    assigneeId: number,
    operatorId: number,
    operatorName: string,
  ) {
    const results = await Promise.all(
      ids.map((id) =>
        this.assign(id, assigneeId, operatorId, operatorName),
      ),
    );
    return results.filter(Boolean);
  }

  private buildQuery(filters: SearchFilters) {
    const qb = this.repo.createQueryBuilder('task');

    if (filters.category) {
      qb.andWhere('task.category = :category', { category: filters.category });
    }
    if (filters.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      qb.andWhere('task.priority = :priority', { priority: filters.priority });
    }
    if (filters.assigneeId !== undefined) {
      qb.andWhere('task.assigneeId = :assigneeId', {
        assigneeId: filters.assigneeId,
      });
    }
    if (filters.assignerId !== undefined) {
      qb.andWhere('task.assignerId = :assignerId', {
        assignerId: filters.assignerId,
      });
    }
    if (filters.createdBy !== undefined) {
      qb.andWhere('task.createdBy = :createdBy', {
        createdBy: filters.createdBy,
      });
    }
    if (filters.rehearsalId !== undefined) {
      qb.andWhere('task.rehearsalId = :rehearsalId', {
        rehearsalId: filters.rehearsalId,
      });
    }
    if (filters.roleId !== undefined) {
      qb.andWhere(
        'task.roleId = :roleId OR JSON_EXTRACT(task.relatedRoleIds, "$") LIKE :rolePattern',
        { roleId: filters.roleId, rolePattern: `%${filters.roleId}%` },
      );
    }
    if (filters.materialId !== undefined) {
      qb.andWhere(
        'task.materialId = :materialId OR JSON_EXTRACT(task.relatedMaterialIds, "$") LIKE :materialPattern',
        {
          materialId: filters.materialId,
          materialPattern: `%${filters.materialId}%`,
        },
      );
    }
    if (filters.performanceId !== undefined) {
      qb.andWhere('task.performanceId = :performanceId', {
        performanceId: filters.performanceId,
      });
    }
    if (filters.keyword) {
      qb.andWhere(
        '(task.title LIKE :keyword OR task.description LIKE :keyword)',
        { keyword: `%${filters.keyword}%` },
      );
    }
    if (filters.tags) {
      const tagList = filters.tags.split(',').map((t) => t.trim()).filter(Boolean);
      tagList.forEach((tag, idx) => {
        qb.andWhere(`JSON_EXTRACT(task.tags, "$") LIKE :tag${idx}`, {
          [`tag${idx}`]: `%${tag}%`,
        });
      });
    }
    if (filters.dueFrom || filters.dueTo) {
      const from = filters.dueFrom ? new Date(filters.dueFrom) : new Date('1970-01-01');
      const to = filters.dueTo ? new Date(filters.dueTo + 'T23:59:59') : new Date('2999-12-31');
      qb.andWhere('task.dueDate BETWEEN :from AND :to', { from, to });
    }
    if (filters.includeFollowerOf !== undefined) {
      qb.andWhere(
        'JSON_EXTRACT(task.followerIds, "$") LIKE :followerPattern',
        { followerPattern: `%${filters.includeFollowerOf}%` },
      );
    }

    return qb;
  }

  private async enrichAll(tasks: Task[]) {
    const userIds = new Set<number>();
    const roleIds = new Set<number>();
    const rehearsalIds = new Set<number>();
    const materialIds = new Set<number>();

    tasks.forEach((t) => {
      if (t.assigneeId) userIds.add(t.assigneeId);
      if (t.assignerId) userIds.add(t.assignerId);
      if (t.createdBy) userIds.add(t.createdBy);
      (t.followerIds || []).forEach((id) => userIds.add(id));
      (t.comments || []).forEach((c) => userIds.add(c.userId));
      (t.statusHistory || []).forEach((h) => userIds.add(h.userId));
      if (t.roleId) roleIds.add(t.roleId);
      (t.relatedRoleIds || []).forEach((id) => roleIds.add(id));
      if (t.rehearsalId) rehearsalIds.add(t.rehearsalId);
      if (t.materialId) materialIds.add(t.materialId);
      (t.relatedMaterialIds || []).forEach((id) => materialIds.add(id));
    });

    const [users, roles, rehearsals, materials] = await Promise.all([
      userIds.size > 0
        ? this.userRepo.findByIds(Array.from(userIds))
        : Promise.resolve([]),
      roleIds.size > 0
        ? this.roleRepo.findByIds(Array.from(roleIds))
        : Promise.resolve([]),
      rehearsalIds.size > 0
        ? this.rehearsalRepo.findByIds(Array.from(rehearsalIds))
        : Promise.resolve([]),
      materialIds.size > 0
        ? this.materialRepo.findByIds(Array.from(materialIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    const rehearsalMap = new Map(rehearsals.map((r) => [r.id, r]));
    const materialMap = new Map(materials.map((m) => [m.id, m]));

    return tasks.map((t) => {
      const assignee = t.assigneeId ? userMap.get(t.assigneeId) : null;
      const assigner = t.assignerId ? userMap.get(t.assignerId) : null;
      const creator = t.createdBy ? userMap.get(t.createdBy) : null;
      const role = t.roleId ? roleMap.get(t.roleId) : null;
      const rehearsal = t.rehearsalId ? rehearsalMap.get(t.rehearsalId) : null;
      const material = t.materialId ? materialMap.get(t.materialId) : null;

      const now = new Date();
      const isOverdue =
        t.dueDate &&
        t.dueDate < now &&
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.CANCELLED;

      return {
        ...t,
        assigneeName: assignee?.displayName || assignee?.username,
        assignerName: assigner?.displayName || assigner?.username,
        creatorName: creator?.displayName || creator?.username,
        roleName: role?.characterName,
        rehearsalTitle: rehearsal?.title,
        materialName: material?.originalName,
        relatedRoles: (t.relatedRoleIds || [])
          .map((id) => {
            const r = roleMap.get(id);
            return r ? { id, name: r.characterName } : null;
          })
          .filter(Boolean),
        relatedMaterials: (t.relatedMaterialIds || [])
          .map((id) => {
            const m = materialMap.get(id);
            return m
              ? { id, name: m.originalName, storedName: m.storedName }
              : null;
          })
          .filter(Boolean),
        followers: (t.followerIds || [])
          .map((id) => {
            const u = userMap.get(id);
            return u
              ? { id, username: u.username, displayName: u.displayName }
              : null;
          })
          .filter(Boolean),
        enrichedComments: (t.comments || [])
          .map((c) => {
            const u = userMap.get(c.userId);
            return {
              ...c,
              username: u?.username,
              displayName: u?.displayName,
            };
          })
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
        enrichedStatusHistory: (t.statusHistory || [])
          .map((h) => {
            const u = userMap.get(h.userId);
            return {
              ...h,
              username: u?.username,
              displayName: u?.displayName,
            };
          })
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
        isOverdue: !!isOverdue,
      };
    });
  }
}
