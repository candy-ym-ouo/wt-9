import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import {
  Reminder,
  ReminderConfig,
  ReminderType,
  ReminderChannel,
  ReminderStatus,
  UserRole,
  Rehearsal,
  User,
  CastRole,
  LeaveRequest,
  LeaveStatus,
} from '../entities';
import { RehearsalsService } from '../rehearsals/rehearsals.service';

export interface TodayTask {
  rehearsal: Rehearsal;
  role: string;
  tasks: string[];
  priority: 'high' | 'medium' | 'low';
  participants: any[];
}

export interface ReminderSummary {
  total: number;
  unread: number;
  todayTasks: TodayTask[];
  upcomingRehearsals: Rehearsal[];
}

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private reminderRepo: Repository<Reminder>,
    @InjectRepository(ReminderConfig)
    private configRepo: Repository<ReminderConfig>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(LeaveRequest)
    private leaveRepo: Repository<LeaveRequest>,
    private rehearsalsService: RehearsalsService,
  ) {}

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private getTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { start, end };
  }

  async getTodayRehearsalsForUser(userId: number, userRole: UserRole): Promise<Rehearsal[]> {
    const { start, end } = this.getTodayRange();
    const allRehearsals = await this.rehearsalRepo.find({ order: { startTime: 'ASC' } });

    const todayRehearsals = allRehearsals.filter((r) => {
      if (r.startTime < start || r.startTime > end) return false;

      if (userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR) {
        return true;
      }

      return r.participantIds?.includes(userId);
    });

    return todayRehearsals;
  }

  async generateTodayTasks(userId: number, userRole: UserRole): Promise<TodayTask[]> {
    const todayRehearsals = await this.getTodayRehearsalsForUser(userId, userRole);
    const tasks: TodayTask[] = [];

    for (const rehearsal of todayRehearsals) {
      const participantInfo = await this.rehearsalsService.getParticipantsWithLeaveInfo(rehearsal);
      const userParticipation = participantInfo.find((p) => p.userId === userId);
      const role = userParticipation?.roleName || this.getRoleLabel(userRole);

      const taskList = await this.generateTasksForRehearsal(rehearsal, userRole, userId, participantInfo);
      const priority = this.calculatePriority(rehearsal, userRole, participantInfo);

      tasks.push({
        rehearsal,
        role,
        tasks: taskList,
        priority,
        participants: participantInfo,
      });
    }

    return tasks;
  }

  private getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      [UserRole.ADMIN]: '系统管理员',
      [UserRole.DIRECTOR]: '导演',
      [UserRole.ACTOR]: '演员',
      [UserRole.VIEWER]: '观察者',
    };
    return labels[role];
  }

  private async generateTasksForRehearsal(
    rehearsal: Rehearsal,
    userRole: UserRole,
    userId: number,
    participants: any[],
  ): Promise<string[]> {
    const tasks: string[] = [];
    const userInfo = participants.find((p) => p.userId === userId);

    if (userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR) {
      tasks.push('确认排练场地和设备准备就绪');
      tasks.push('检查所有参演人员的到场情况');

      const onLeaveCount = participants.filter((p) => p.isOnLeave).length;
      if (onLeaveCount > 0) {
        tasks.push(`处理 ${onLeaveCount} 名请假人员的替补安排`);
      }

      const conflicts = participants.filter(
        (p) => p.isOnLeave && !p.substituteId,
      ).length;
      if (conflicts > 0) {
        tasks.push(`⚠️ ${conflicts} 个角色暂无替补，需要紧急协调`);
      }

      if (rehearsal.description) {
        tasks.push('审阅排练内容和目标');
      }

      tasks.push('排练结束后更新排练记录和备注');
    } else if (userRole === UserRole.ACTOR) {
      if (userInfo?.isOnLeave && userInfo?.substituteId) {
        tasks.push(`您已请假，由 ${userInfo.substituteName} 代您参演`);
      } else if (userInfo?.isOnLeave) {
        tasks.push('您已请假，请确保已安排好替补');
      } else {
        if (userInfo?.roleName) {
          tasks.push(`准备「${userInfo.roleName}」角色的台词和表演`);
        }

        const timeStr = this.formatTime(rehearsal.startTime);
        tasks.push(`${timeStr} 准时到达「${rehearsal.location || '待定'}」`);

        const userRoles = await this.roleRepo.find({ where: { actorId: userId } });
        const rehearsalScenes = userRoles
          .filter((r) => r.sceneNumbers?.length > 0)
          .flatMap((r) => r.sceneNumbers || []);
        if (rehearsalScenes.length > 0) {
          tasks.push(`重点复习第 ${[...new Set(rehearsalScenes)].join(', ')} 场`);
        }

        tasks.push('携带剧本和相关资料');
      }
    } else {
      tasks.push(`观看排练：${rehearsal.title}`);
    }

    return tasks;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  private calculatePriority(
    rehearsal: Rehearsal,
    userRole: UserRole,
    participants: any[],
  ): 'high' | 'medium' | 'low' {
    const now = new Date();
    const diffMinutes = (rehearsal.startTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < 60) return 'high';

    const conflicts = participants.filter((p) => p.isOnLeave && !p.substituteId).length;
    if (conflicts > 0) return 'high';

    if (userRole === UserRole.DIRECTOR || userRole === UserRole.ADMIN) {
      return diffMinutes < 120 ? 'high' : 'medium';
    }

    return diffMinutes < 120 ? 'medium' : 'low';
  }

  async getReminderSummary(userId: number, userRole: UserRole): Promise<ReminderSummary> {
    const [reminders, todayTasks, upcomingRehearsals] = await Promise.all([
      this.reminderRepo.find({ where: { userId } }),
      this.generateTodayTasks(userId, userRole),
      this.getUpcomingRehearsals(userId, userRole),
    ]);

    const unread = reminders.filter((r) => r.status === ReminderStatus.SENT || r.status === ReminderStatus.PENDING).length;

    return {
      total: reminders.length,
      unread,
      todayTasks,
      upcomingRehearsals,
    };
  }

  async getUpcomingRehearsals(userId: number, userRole: UserRole, days: number = 7): Promise<Rehearsal[]> {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const allRehearsals = await this.rehearsalRepo.find({ order: { startTime: 'ASC' } });

    return allRehearsals.filter((r) => {
      if (r.startTime < now || r.startTime > end) return false;
      if (this.isSameDay(r.startTime, now)) return false;

      if (userRole === UserRole.ADMIN || userRole === UserRole.DIRECTOR) {
        return true;
      }

      return r.participantIds?.includes(userId);
    });
  }

  async getUserReminders(
    userId: number,
    options: {
      status?: ReminderStatus;
      type?: ReminderType;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: Reminder[]; total: number }> {
    const where: any = { userId };
    if (options.status) where.status = options.status;
    if (options.type) where.type = options.type;

    const [items, total] = await this.reminderRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return { items, total };
  }

  async markAsRead(reminderId: number, userId: number): Promise<Reminder> {
    const reminder = await this.reminderRepo.findOne({ where: { id: reminderId, userId } });
    if (!reminder) {
      throw new NotFoundException('提醒不存在');
    }

    reminder.status = ReminderStatus.READ;
    reminder.readAt = new Date();
    return this.reminderRepo.save(reminder);
  }

  async markAllAsRead(userId: number): Promise<number> {
    const result = await this.reminderRepo.update(
      { userId, status: In([ReminderStatus.PENDING, ReminderStatus.SENT]) },
      { status: ReminderStatus.READ, readAt: new Date() },
    );
    return result.affected || 0;
  }

  async dismissReminder(reminderId: number, userId: number): Promise<Reminder> {
    const reminder = await this.reminderRepo.findOne({ where: { id: reminderId, userId } });
    if (!reminder) {
      throw new NotFoundException('提醒不存在');
    }

    reminder.status = ReminderStatus.DISMISSED;
    return this.reminderRepo.save(reminder);
  }

  async createReminder(data: Partial<Reminder>): Promise<Reminder> {
    if (!data.userId || !data.type || !data.title || !data.message) {
      throw new BadRequestException('缺少必填字段');
    }

    const reminder = this.reminderRepo.create({
      ...data,
      status: data.status || ReminderStatus.PENDING,
      channel: data.channel || ReminderChannel.IN_APP,
    });

    return this.reminderRepo.save(reminder);
  }

  async getConfigs(): Promise<ReminderConfig[]> {
    return this.configRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getConfig(id: number): Promise<ReminderConfig | null> {
    return this.configRepo.findOne({ where: { id } });
  }

  async createConfig(data: Partial<ReminderConfig>, createdBy: number): Promise<ReminderConfig> {
    if (!data.type) {
      throw new BadRequestException('提醒类型必填');
    }

    const config = this.configRepo.create({
      ...data,
      createdBy,
      enabled: data.enabled ?? true,
      advanceMinutes: data.advanceMinutes || 60,
    });

    return this.configRepo.save(config);
  }

  async updateConfig(id: number, data: Partial<ReminderConfig>): Promise<ReminderConfig> {
    const existing = await this.configRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('配置不存在');
    }

    await this.configRepo.update(id, data);
    return this.configRepo.findOne({ where: { id } }) as Promise<ReminderConfig>;
  }

  async deleteConfig(id: number): Promise<void> {
    const result = await this.configRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException('配置不存在');
    }
  }

  async generateDailyReminders(): Promise<number> {
    const users = await this.userRepo.find();
    let createdCount = 0;

    for (const user of users) {
      const todayTasks = await this.generateTodayTasks(user.id, user.role);

      if (todayTasks.length > 0) {
        const message = this.formatDailyReminderMessage(todayTasks);
        await this.createReminder({
          userId: user.id,
          type: ReminderType.REHEARSAL_TODAY,
          channel: ReminderChannel.IN_APP,
          title: `今日排练提醒（${todayTasks.length} 场）`,
          message,
          metadata: { tasks: todayTasks },
          status: ReminderStatus.SENT,
          sentAt: new Date(),
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  private formatDailyReminderMessage(tasks: TodayTask[]): string {
    const lines: string[] = [];

    tasks.forEach((task, index) => {
      const time = this.formatTime(task.rehearsal.startTime);
      const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`\n${priorityIcon} ${index + 1}. ${task.rehearsal.title}`);
      lines.push(`   时间：${time} | 地点：${task.rehearsal.location || '待定'}`);
      lines.push(`   角色：${task.role}`);
      lines.push(`   任务：`);
      task.tasks.forEach((t) => lines.push(`     • ${t}`));
    });

    return lines.join('\n');
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.reminderRepo.count({
      where: {
        userId,
        status: In([ReminderStatus.PENDING, ReminderStatus.SENT]),
      },
    });
  }

  async initializeDefaultConfigs(createdBy: number): Promise<ReminderConfig[]> {
    const existing = await this.configRepo.count();
    if (existing > 0) {
      return this.getConfigs();
    }

    const defaultConfigs: Partial<ReminderConfig>[] = [
      {
        type: ReminderType.REHEARSAL_TODAY,
        targetRoles: [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.ACTOR, UserRole.VIEWER],
        channels: [ReminderChannel.IN_APP],
        enabled: true,
        advanceMinutes: 0,
        template: '今日有 {count} 场排练待参加',
      },
      {
        type: ReminderType.REHEARSAL_UPCOMING,
        targetRoles: [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.ACTOR],
        channels: [ReminderChannel.IN_APP],
        enabled: true,
        advanceMinutes: 60,
        template: '排练将在 {minutes} 分钟后开始',
      },
      {
        type: ReminderType.TASK_ASSIGNED,
        targetRoles: [UserRole.ADMIN, UserRole.DIRECTOR],
        channels: [ReminderChannel.IN_APP],
        enabled: true,
        advanceMinutes: 0,
        template: '您有新的任务需要处理',
      },
    ];

    const results: ReminderConfig[] = [];
    for (const config of defaultConfigs) {
      results.push(await this.createConfig(config, createdBy));
    }

    return results;
  }
}
