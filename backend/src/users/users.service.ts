import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus, AuditAction, AuditModule } from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAll() {
    return this.userRepo.find({ select: ['id', 'username', 'role', 'displayName', 'status', 'frozenAt', 'createdAt'] });
  }

  async findOne(id: number) {
    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName', 'status', 'frozenAt', 'createdAt'] });
  }

  async findById(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  async updateRole(id: number, role: UserRole, operatorId: number, operatorName: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const oldRole = user.role;

    await this.userRepo.update(id, { role });

    const roleLabels: Record<string, string> = { admin: '管理员', director: '导演', actor: '演员', viewer: '观察者' };
    await this.auditLogsService.log({
      action: AuditAction.UPDATE_USER_ROLE,
      module: AuditModule.USER,
      operatorId,
      operatorName,
      targetUserId: id,
      targetUsername: user.username,
      targetId: id,
      targetType: 'user',
      detail: `将用户 ${user.username} 的角色从 ${roleLabels[oldRole] || oldRole} 变更为 ${roleLabels[role] || role}`,
      metadata: { oldRole, newRole: role },
    });

    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName'] });
  }

  async freeze(id: number, operatorId: number, operatorName: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    if (user.status === UserStatus.FROZEN) return user;

    await this.userRepo.update(id, { status: UserStatus.FROZEN, frozenAt: new Date() });

    await this.auditLogsService.log({
      action: AuditAction.FREEZE_USER,
      module: AuditModule.USER,
      operatorId,
      operatorName,
      targetUserId: id,
      targetUsername: user.username,
      targetId: id,
      targetType: 'user',
      detail: `冻结用户 ${user.username}`,
    });

    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName', 'status', 'frozenAt'] });
  }

  async unfreeze(id: number, operatorId: number, operatorName: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    if (user.status === UserStatus.ACTIVE) return user;

    await this.userRepo.update(id, { status: UserStatus.ACTIVE, frozenAt: null });

    await this.auditLogsService.log({
      action: AuditAction.UNFREEZE_USER,
      module: AuditModule.USER,
      operatorId,
      operatorName,
      targetUserId: id,
      targetUsername: user.username,
      targetId: id,
      targetType: 'user',
      detail: `解冻用户 ${user.username}`,
    });

    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName', 'status', 'frozenAt'] });
  }

  async remove(id: number, operatorId: number, operatorName: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (user) {
      await this.auditLogsService.log({
        action: AuditAction.DELETE_USER,
        module: AuditModule.USER,
        operatorId,
        operatorName,
        targetUserId: id,
        targetUsername: user.username,
        targetId: id,
        targetType: 'user',
        detail: `删除用户 ${user.username}`,
      });
    }
    return this.userRepo.delete(id);
  }
}
