import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import {
  Approval,
  ApprovalType,
  ApprovalStatus,
  ApprovalStepStatus,
  User,
  CastRole,
  Material,
  Performance,
  AuditAction,
  AuditModule,
  UserRole,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DramasService } from '../dramas/dramas.service';

export interface CreateApprovalParams {
  type: ApprovalType;
  title: string;
  description?: string;
  dramaId?: number;
  targetId: number;
  targetType: string;
  targetData?: Record<string, any>;
  approverIds: number[];
}

export interface ApprovalQueryParams {
  dramaId?: number;
  type?: ApprovalType;
  status?: ApprovalStatus;
  requesterId?: number;
  approverId?: number;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval)
    private approvalRepo: Repository<Approval>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(Performance)
    private performanceRepo: Repository<Performance>,
    private auditLogsService: AuditLogsService,
    private dramasService: DramasService,
  ) {}

  async create(params: CreateApprovalParams, operatorId: number, operatorName: string) {
    if (params.dramaId) {
      await this.dramasService.checkAccess(params.dramaId, operatorId, ['viewer']);
    }

    const users = await this.userRepo.findByIds(params.approverIds);
    const approverMap = new Map(users.map((u) => [u.id, u]));

    const steps = params.approverIds.map((id, index) => ({
      index,
      approverId: id,
      approverName: approverMap.get(id)?.displayName || approverMap.get(id)?.username,
      status: ApprovalStepStatus.PENDING,
      comment: undefined,
      decidedAt: undefined,
    }));

    const approval = this.approvalRepo.create({
      type: params.type,
      title: params.title,
      description: params.description,
      dramaId: params.dramaId,
      targetId: params.targetId,
      targetType: params.targetType,
      targetData: params.targetData ? JSON.stringify(params.targetData) : undefined,
      requesterId: operatorId,
      requesterName: operatorName,
      approverIds: params.approverIds,
      currentStepIndex: params.approverIds.length > 0 ? 0 : 0,
      steps,
    });

    const saved = await this.approvalRepo.save(approval);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_APPROVAL,
      module: AuditModule.APPROVAL,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'approval',
      detail: `创建审批「${saved.title}」（${this.getTypeLabel(saved.type)}）`,
      metadata: {
        id: saved.id,
        type: saved.type,
        targetId: saved.targetId,
        targetType: saved.targetType,
        approverIds: saved.approverIds,
      },
    });

    return this.findOne(saved.id, operatorId);
  }

  async findAll(params: ApprovalQueryParams, userId: number) {
    const qb = this.approvalRepo.createQueryBuilder('approval').orderBy('approval.createdAt', 'DESC');

    if (params?.dramaId) {
      await this.dramasService.checkAccess(params.dramaId, userId, ['viewer']);
      qb.andWhere('approval.dramaId = :dramaId', { dramaId: params.dramaId });
    } else {
      const dramaIds = await this.dramasService.getUserDramaIds(userId);
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user?.role !== UserRole.ADMIN) {
        qb.andWhere(
          new Brackets((qb2) => {
            qb2.where('approval.dramaId IS NULL');
            if (dramaIds.length > 0) {
              qb2.orWhere('approval.dramaId IN (:...dramaIds)', { dramaIds });
            }
            qb2.orWhere('approval.requesterId = :userId', { userId });
          }),
        );
      }
    }

    if (params?.type) {
      qb.andWhere('approval.type = :type', { type: params.type });
    }
    if (params?.status) {
      qb.andWhere('approval.status = :status', { status: params.status });
    }
    if (params?.requesterId) {
      qb.andWhere('approval.requesterId = :requesterId', { requesterId: params.requesterId });
    }
    if (params?.approverId) {
      qb.andWhere('approval.approverIds LIKE :approverId', { approverId: `%${params.approverId}%` });
    }
    if (params?.keyword) {
      const kw = `%${params.keyword}%`;
      qb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('approval.title LIKE :kw', { kw })
            .orWhere('approval.description LIKE :kw', { kw });
        }),
      );
    }
    if (params?.dateFrom) {
      qb.andWhere('approval.createdAt >= :dateFrom', { dateFrom: new Date(params.dateFrom) });
    }
    if (params?.dateTo) {
      const endDate = new Date(params.dateTo);
      endDate.setHours(23, 59, 59, 999);
      qb.andWhere('approval.createdAt <= :dateTo', { dateTo: endDate });
    }
    if (params?.limit) {
      qb.limit(params.limit);
    }
    if (params?.offset) {
      qb.offset(params.offset);
    }

    const [items, total] = await qb.getManyAndCount();
    const enriched = await Promise.all(items.map((item) => this.enrichApproval(item)));

    return { items, total, enriched };
  }

  async findMyApprovals(userId: number, status?: ApprovalStatus) {
    const qb = this.approvalRepo
      .createQueryBuilder('approval')
      .where('approval.approverIds LIKE :userId', { userId: `%${userId}%` })
      .andWhere('approval.status = :status', { status: status || ApprovalStatus.PENDING })
      .orderBy('approval.createdAt', 'DESC');

    const items = await qb.getMany();
    return Promise.all(items.map((item) => this.enrichApproval(item)));
  }

  async findMyRequested(userId: number, status?: ApprovalStatus) {
    const qb = this.approvalRepo
      .createQueryBuilder('approval')
      .where('approval.requesterId = :userId', { userId })
      .orderBy('approval.createdAt', 'DESC');

    if (status) {
      qb.andWhere('approval.status = :status', { status });
    }

    const items = await qb.getMany();
    return Promise.all(items.map((item) => this.enrichApproval(item)));
  }

  async findOne(id: number, userId: number) {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) return null;

    if (approval.dramaId) {
      await this.dramasService.checkAccess(approval.dramaId, userId, ['viewer']);
    } else {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (
        user?.role !== UserRole.ADMIN &&
        approval.requesterId !== userId &&
        !approval.approverIds?.includes(userId)
      ) {
        throw new ForbiddenException('无权限查看此审批');
      }
    }

    return this.enrichApproval(approval);
  }

  async approve(id: number, comment: string, operatorId: number, operatorName: string) {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) {
      throw new NotFoundException('审批不存在');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`审批状态为${this.getStatusLabel(approval.status)}，无法审批`);
    }

    const currentStep = approval.steps[approval.currentStepIndex];
    if (!currentStep || currentStep.approverId !== operatorId) {
      throw new ForbiddenException('您不是当前审批人');
    }

    const updatedSteps = [...approval.steps];
    updatedSteps[approval.currentStepIndex] = {
      ...currentStep,
      status: ApprovalStepStatus.APPROVED,
      comment,
      decidedAt: new Date(),
    };

    const isLastStep = approval.currentStepIndex >= approval.steps.length - 1;

    let updateData: Partial<Approval> = {
      steps: updatedSteps,
    };

    if (isLastStep) {
      updateData = {
        ...updateData,
        status: ApprovalStatus.APPROVED,
        currentStepIndex: approval.currentStepIndex,
        finalApproverId: operatorId,
        finalApproverName: operatorName,
        finalComment: comment,
        decidedAt: new Date(),
      };

      await this.executeApprovalAction(approval);
    } else {
      updateData = {
        ...updateData,
        currentStepIndex: approval.currentStepIndex + 1,
      };
    }

    await this.approvalRepo.update(id, updateData);

    await this.auditLogsService.log({
      action: isLastStep ? AuditAction.APPROVE_APPROVAL : AuditAction.APPROVE_APPROVAL_STEP,
      module: AuditModule.APPROVAL,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'approval',
      detail: isLastStep
        ? `最终通过审批「${approval.title}」`
        : `通过审批「${approval.title}」第${approval.currentStepIndex + 1}步`,
      metadata: { id, step: approval.currentStepIndex + 1, comment },
    });

    return this.findOne(id, operatorId);
  }

  async reject(id: number, comment: string, operatorId: number, operatorName: string) {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) {
      throw new NotFoundException('审批不存在');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`审批状态为${this.getStatusLabel(approval.status)}，无法审批`);
    }

    const currentStep = approval.steps[approval.currentStepIndex];
    if (!currentStep || currentStep.approverId !== operatorId) {
      throw new ForbiddenException('您不是当前审批人');
    }

    const updatedSteps = [...approval.steps];
    updatedSteps[approval.currentStepIndex] = {
      ...currentStep,
      status: ApprovalStepStatus.REJECTED,
      comment,
      decidedAt: new Date(),
    };

    await this.approvalRepo.update(id, {
      status: ApprovalStatus.REJECTED,
      steps: updatedSteps,
      finalApproverId: operatorId,
      finalApproverName: operatorName,
      finalComment: comment,
      decidedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.REJECT_APPROVAL,
      module: AuditModule.APPROVAL,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'approval',
      detail: `驳回审批「${approval.title}」（第${approval.currentStepIndex + 1}步）`,
      metadata: { id, step: approval.currentStepIndex + 1, comment },
    });

    return this.findOne(id, operatorId);
  }

  async cancel(id: number, operatorId: number, operatorName: string) {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) {
      throw new NotFoundException('审批不存在');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`审批状态为${this.getStatusLabel(approval.status)}，无法取消`);
    }
    if (approval.requesterId !== operatorId) {
      const user = await this.userRepo.findOne({ where: { id: operatorId } });
      if (user?.role !== UserRole.ADMIN) {
        throw new ForbiddenException('只有申请人或管理员可以取消审批');
      }
    }

    await this.approvalRepo.update(id, {
      status: ApprovalStatus.CANCELLED,
      decidedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.CANCEL_APPROVAL,
      module: AuditModule.APPROVAL,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'approval',
      detail: `取消审批「${approval.title}」`,
      metadata: { id },
    });

    return this.findOne(id, operatorId);
  }

  async getStats(userId: number) {
    const dramaIds = await this.dramasService.getUserDramaIds(userId);
    const user = await this.userRepo.findOne({ where: { id: userId } });

    const qb = this.approvalRepo.createQueryBuilder('approval');

    if (user?.role !== UserRole.ADMIN) {
      qb.andWhere(
        new Brackets((qb2) => {
          qb2.where('approval.dramaId IS NULL');
          if (dramaIds.length > 0) {
            qb2.orWhere('approval.dramaId IN (:...dramaIds)', { dramaIds });
          }
          qb2.orWhere('approval.requesterId = :userId', { userId });
        }),
      );
    }

    const all = await qb.getMany();

    return {
      total: all.length,
      pending: all.filter((a) => a.status === ApprovalStatus.PENDING).length,
      approved: all.filter((a) => a.status === ApprovalStatus.APPROVED).length,
      rejected: all.filter((a) => a.status === ApprovalStatus.REJECTED).length,
      cancelled: all.filter((a) => a.status === ApprovalStatus.CANCELLED).length,
      myPending: all.filter(
        (a) =>
          a.status === ApprovalStatus.PENDING &&
          a.approverIds?.includes(userId) &&
          a.steps[a.currentStepIndex]?.approverId === userId,
      ).length,
      myRequested: all.filter((a) => a.requesterId === userId).length,
    };
  }

  private async enrichApproval(approval: Approval) {
    const targetData = approval.targetData ? JSON.parse(approval.targetData) : null;

    let targetInfo: any = null;
    switch (approval.targetType) {
      case 'material':
        const material = await this.materialRepo.findOne({ where: { id: approval.targetId } });
        if (material) {
          targetInfo = {
            id: material.id,
            name: material.originalName,
            category: material.category,
          };
        }
        break;
      case 'role':
        const role = await this.roleRepo.findOne({ where: { id: approval.targetId } });
        if (role) {
          targetInfo = {
            id: role.id,
            characterName: role.characterName,
            actorId: role.actorId,
          };
          if (role.actorId) {
            const actor = await this.userRepo.findOne({ where: { id: role.actorId } });
            targetInfo.actorName = actor?.displayName || actor?.username;
          }
        }
        break;
      case 'performance':
        const performance = await this.performanceRepo.findOne({ where: { id: approval.targetId } });
        if (performance) {
          targetInfo = {
            id: performance.id,
            title: performance.title,
            startTime: performance.startTime,
            endTime: performance.endTime,
            venue: performance.venue,
            status: performance.status,
          };
        }
        break;
    }

    return {
      ...approval,
      targetData,
      targetInfo,
      typeLabel: this.getTypeLabel(approval.type),
      statusLabel: this.getStatusLabel(approval.status),
    };
  }

  private async executeApprovalAction(approval: Approval) {
    switch (approval.type) {
      case ApprovalType.MATERIAL_OFFSHELF:
        await this.handleMaterialOffshelf(approval);
        break;
      case ApprovalType.ROLE_ADJUSTMENT:
        await this.handleRoleAdjustment(approval);
        break;
      case ApprovalType.PERFORMANCE_CHANGE:
        await this.handlePerformanceChange(approval);
        break;
    }
  }

  private async handleMaterialOffshelf(approval: Approval) {
    const material = await this.materialRepo.findOne({ where: { id: approval.targetId } });
    if (material) {
      await this.materialRepo.update(approval.targetId, {
        category: 'archived',
      });
    }
  }

  private async handleRoleAdjustment(approval: Approval) {
    const data = approval.targetData ? JSON.parse(approval.targetData) : null;
    if (data?.changes) {
      await this.roleRepo.update(approval.targetId, data.changes);
    }
  }

  private async handlePerformanceChange(approval: Approval) {
    const data = approval.targetData ? JSON.parse(approval.targetData) : null;
    if (data?.changes) {
      await this.performanceRepo.update(approval.targetId, data.changes);
    }
  }

  private getTypeLabel(type: ApprovalType) {
    const labels: Record<ApprovalType, string> = {
      [ApprovalType.MATERIAL_OFFSHELF]: '素材下架',
      [ApprovalType.ROLE_ADJUSTMENT]: '角色调整',
      [ApprovalType.PERFORMANCE_CHANGE]: '场次变更',
    };
    return labels[type] || type;
  }

  private getStatusLabel(status: ApprovalStatus) {
    const labels: Record<ApprovalStatus, string> = {
      [ApprovalStatus.PENDING]: '待审批',
      [ApprovalStatus.APPROVED]: '已通过',
      [ApprovalStatus.REJECTED]: '已驳回',
      [ApprovalStatus.CANCELLED]: '已取消',
    };
    return labels[status] || status;
  }
}
