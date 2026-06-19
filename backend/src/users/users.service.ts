import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus, AuditAction } from '../entities';
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

  async updateRole(id: number, role: UserRole) {
    await this.userRepo.update(id, { role });
    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName'] });
  }

  async freeze(id: number, operatorId: number, operatorName: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    if (user.status === UserStatus.FROZEN) return user;

    await this.userRepo.update(id, { status: UserStatus.FROZEN, frozenAt: new Date() });

    await this.auditLogsService.log({
      action: AuditAction.FREEZE_USER,
      operatorId,
      operatorName,
      targetUserId: id,
      targetUsername: user.username,
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
      operatorId,
      operatorName,
      targetUserId: id,
      targetUsername: user.username,
      detail: `解冻用户 ${user.username}`,
    });

    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName', 'status', 'frozenAt'] });
  }

  async remove(id: number) {
    return this.userRepo.delete(id);
  }
}
