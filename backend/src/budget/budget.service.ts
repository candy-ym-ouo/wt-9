import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExpenseCategory,
  Reimbursement,
  ReimbursementStatus,
  MaterialPurchase,
  PurchaseStatus,
  User,
  Performance,
  AuditAction,
  AuditModule,
} from '../entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private categoryRepo: Repository<ExpenseCategory>,
    @InjectRepository(Reimbursement)
    private reimbursementRepo: Repository<Reimbursement>,
    @InjectRepository(MaterialPurchase)
    private purchaseRepo: Repository<MaterialPurchase>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Performance)
    private performanceRepo: Repository<Performance>,
    private auditLogsService: AuditLogsService,
  ) {}

  async createCategory(data: Partial<ExpenseCategory>, operatorId: number, operatorName: string) {
    const item = this.categoryRepo.create({
      ...data,
      createdBy: operatorId,
    });
    const saved = await this.categoryRepo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_EXPENSE_CATEGORY,
      module: AuditModule.EXPENSE_CATEGORY,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'expense_category',
      detail: `创建费用分类「${saved.name}」`,
      metadata: { name: saved.name },
    });

    return saved;
  }

  async findAllCategories(onlyActive: boolean = false) {
    const where: any = {};
    if (onlyActive) where.isActive = true;
    return this.categoryRepo.find({ where, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async findOneCategory(id: number) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('费用分类不存在');
    return category;
  }

  async updateCategory(id: number, data: Partial<ExpenseCategory>, operatorId: number, operatorName: string) {
    const old = await this.categoryRepo.findOne({ where: { id } });
    if (!old) throw new NotFoundException('费用分类不存在');

    await this.categoryRepo.update(id, data);
    const updated = await this.findOneCategory(id);

    const changes: string[] = [];
    if (data.name && data.name !== old.name) {
      changes.push(`名称: ${old.name} → ${data.name}`);
    }
    if (data.isActive !== undefined && data.isActive !== old.isActive) {
      changes.push(`状态: ${old.isActive ? '启用' : '停用'} → ${data.isActive ? '启用' : '停用'}`);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_EXPENSE_CATEGORY,
      module: AuditModule.EXPENSE_CATEGORY,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'expense_category',
      detail: changes.length > 0
        ? `更新费用分类「${old.name}」: ${changes.join('; ')}`
        : `更新费用分类「${old.name}」`,
      metadata: { old, new: data },
    });

    return updated;
  }

  async removeCategory(id: number, operatorId: number, operatorName: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('费用分类不存在');

    const reimbursementCount = await this.reimbursementRepo.count({ where: { categoryId: id } });
    const purchaseCount = await this.purchaseRepo.count({ where: { categoryId: id } });
    if (reimbursementCount > 0 || purchaseCount > 0) {
      throw new BadRequestException('该分类下有相关记录，无法删除');
    }

    await this.auditLogsService.log({
      action: AuditAction.DELETE_EXPENSE_CATEGORY,
      module: AuditModule.EXPENSE_CATEGORY,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'expense_category',
      detail: `删除费用分类「${category.name}」`,
      metadata: { name: category.name },
    });

    return this.categoryRepo.delete(id);
  }

  async createReimbursement(data: Partial<Reimbursement>, operatorId: number, operatorName: string) {
    const item = this.reimbursementRepo.create({
      ...data,
      applicantId: operatorId,
      createdBy: operatorId,
      status: ReimbursementStatus.PENDING,
    });
    const saved = await this.reimbursementRepo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_REIMBURSEMENT,
      module: AuditModule.REIMBURSEMENT,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'reimbursement',
      targetUserId: operatorId,
      detail: `创建报销申请「${saved.title}」，金额: ${saved.amount}`,
      metadata: { title: saved.title, amount: saved.amount },
    });

    return this.findOneReimbursement(saved.id);
  }

  async findAllReimbursements(filters?: {
    status?: ReimbursementStatus;
    categoryId?: number;
    applicantId?: number;
    performanceId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.applicantId) where.applicantId = filters.applicantId;
    if (filters?.performanceId) where.performanceId = filters.performanceId;

    let items = await this.reimbursementRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      items = items.filter((r) => r.createdAt >= start && r.createdAt <= end);
    }

    return this.enrichReimbursements(items);
  }

  async findOneReimbursement(id: number) {
    const item = await this.reimbursementRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('报销记录不存在');
    const enriched = await this.enrichReimbursements([item]);
    return enriched[0];
  }

  async updateReimbursement(id: number, data: Partial<Reimbursement>, operatorId: number, operatorName: string) {
    const existing = await this.reimbursementRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('报销记录不存在');

    if (existing.status !== ReimbursementStatus.PENDING) {
      throw new BadRequestException('只有待审批的报销可以修改');
    }

    await this.reimbursementRepo.update(id, data);
    const updated = await this.findOneReimbursement(id);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_REIMBURSEMENT,
      module: AuditModule.REIMBURSEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'reimbursement',
      detail: `更新报销申请「${existing.title}」`,
      metadata: { old: existing, new: data },
    });

    return updated;
  }

  async removeReimbursement(id: number, operatorId: number, operatorName: string) {
    const item = await this.reimbursementRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('报销记录不存在');

    await this.auditLogsService.log({
      action: AuditAction.DELETE_REIMBURSEMENT,
      module: AuditModule.REIMBURSEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'reimbursement',
      detail: `删除报销申请「${item.title}」`,
      metadata: { title: item.title, amount: item.amount },
    });

    return this.reimbursementRepo.delete(id);
  }

  async approveReimbursement(id: number, operatorId: number, operatorName: string) {
    const existing = await this.reimbursementRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('报销记录不存在');

    if (existing.status !== ReimbursementStatus.PENDING) {
      throw new BadRequestException('只有待审批的报销可以审批');
    }

    await this.reimbursementRepo.update(id, {
      status: ReimbursementStatus.APPROVED,
      reviewedBy: operatorId,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.APPROVE_REIMBURSEMENT,
      module: AuditModule.REIMBURSEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'reimbursement',
      targetUserId: existing.applicantId,
      detail: `批准报销申请「${existing.title}」，金额: ${existing.amount}`,
      metadata: { title: existing.title, amount: existing.amount },
    });

    return this.findOneReimbursement(id);
  }

  async rejectReimbursement(id: number, rejectionReason: string, operatorId: number, operatorName: string) {
    const existing = await this.reimbursementRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('报销记录不存在');

    if (existing.status !== ReimbursementStatus.PENDING) {
      throw new BadRequestException('只有待审批的报销可以审批');
    }

    await this.reimbursementRepo.update(id, {
      status: ReimbursementStatus.REJECTED,
      rejectionReason,
      reviewedBy: operatorId,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.REJECT_REIMBURSEMENT,
      module: AuditModule.REIMBURSEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'reimbursement',
      targetUserId: existing.applicantId,
      detail: `驳回报销申请「${existing.title}」，原因: ${rejectionReason}`,
      metadata: { title: existing.title, rejectionReason },
    });

    return this.findOneReimbursement(id);
  }

  async markReimbursementPaid(id: number, operatorId: number, operatorName: string) {
    const existing = await this.reimbursementRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('报销记录不存在');

    if (existing.status !== ReimbursementStatus.APPROVED) {
      throw new BadRequestException('只有已批准的报销可以标记为已付款');
    }

    await this.reimbursementRepo.update(id, {
      status: ReimbursementStatus.PAID,
      paidBy: operatorId,
      paidAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.PAY_REIMBURSEMENT,
      module: AuditModule.REIMBURSEMENT,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'reimbursement',
      targetUserId: existing.applicantId,
      detail: `标记报销「${existing.title}」已付款，金额: ${existing.amount}`,
      metadata: { title: existing.title, amount: existing.amount },
    });

    return this.findOneReimbursement(id);
  }

  async createPurchase(data: Partial<MaterialPurchase>, operatorId: number, operatorName: string) {
    const totalPrice = data.quantity && data.unitPrice ? data.quantity * data.unitPrice : data.totalPrice || 0;
    const item = this.purchaseRepo.create({
      ...data,
      requesterId: operatorId,
      createdBy: operatorId,
      status: PurchaseStatus.PENDING,
      totalPrice,
    });
    const saved = await this.purchaseRepo.save(item);

    await this.auditLogsService.log({
      action: AuditAction.CREATE_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: saved.id,
      targetType: 'material_purchase',
      targetUserId: operatorId,
      detail: `创建物料采购「${saved.itemName}」，总价: ${saved.totalPrice}`,
      metadata: { itemName: saved.itemName, totalPrice: saved.totalPrice },
    });

    return this.findOnePurchase(saved.id);
  }

  async findAllPurchases(filters?: {
    status?: PurchaseStatus;
    categoryId?: number;
    requesterId?: number;
    performanceId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.requesterId) where.requesterId = filters.requesterId;
    if (filters?.performanceId) where.performanceId = filters.performanceId;

    let items = await this.purchaseRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      items = items.filter((p) => p.createdAt >= start && p.createdAt <= end);
    }

    return this.enrichPurchases(items);
  }

  async findOnePurchase(id: number) {
    const item = await this.purchaseRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('采购记录不存在');
    const enriched = await this.enrichPurchases([item]);
    return enriched[0];
  }

  async updatePurchase(id: number, data: Partial<MaterialPurchase>, operatorId: number, operatorName: string) {
    const existing = await this.purchaseRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('采购记录不存在');

    if (existing.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException('只有待审批的采购可以修改');
    }

    const updateData: any = { ...data };
    if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const qty = data.quantity !== undefined ? data.quantity : existing.quantity;
      const price = data.unitPrice !== undefined ? data.unitPrice : existing.unitPrice;
      updateData.totalPrice = qty * price;
    }

    await this.purchaseRepo.update(id, updateData);
    const updated = await this.findOnePurchase(id);

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material_purchase',
      detail: `更新物料采购「${existing.itemName}」`,
      metadata: { old: existing, new: data },
    });

    return updated;
  }

  async removePurchase(id: number, operatorId: number, operatorName: string) {
    const item = await this.purchaseRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('采购记录不存在');

    await this.auditLogsService.log({
      action: AuditAction.DELETE_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material_purchase',
      detail: `删除物料采购「${item.itemName}」`,
      metadata: { itemName: item.itemName, totalPrice: item.totalPrice },
    });

    return this.purchaseRepo.delete(id);
  }

  async approvePurchase(id: number, operatorId: number, operatorName: string) {
    const existing = await this.purchaseRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('采购记录不存在');

    if (existing.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException('只有待审批的采购可以审批');
    }

    await this.purchaseRepo.update(id, {
      status: PurchaseStatus.APPROVED,
      reviewedBy: operatorId,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.APPROVE_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material_purchase',
      targetUserId: existing.requesterId,
      detail: `批准物料采购「${existing.itemName}」，总价: ${existing.totalPrice}`,
      metadata: { itemName: existing.itemName, totalPrice: existing.totalPrice },
    });

    return this.findOnePurchase(id);
  }

  async rejectPurchase(id: number, rejectionReason: string, operatorId: number, operatorName: string) {
    const existing = await this.purchaseRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('采购记录不存在');

    if (existing.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException('只有待审批的采购可以审批');
    }

    await this.purchaseRepo.update(id, {
      status: PurchaseStatus.REJECTED,
      rejectionReason,
      reviewedBy: operatorId,
      reviewedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.REJECT_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material_purchase',
      targetUserId: existing.requesterId,
      detail: `驳回物料采购「${existing.itemName}」，原因: ${rejectionReason}`,
      metadata: { itemName: existing.itemName, rejectionReason },
    });

    return this.findOnePurchase(id);
  }

  async markPurchaseOrdered(id: number, operatorId: number, operatorName: string) {
    const existing = await this.purchaseRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('采购记录不存在');

    if (existing.status !== PurchaseStatus.APPROVED) {
      throw new BadRequestException('只有已批准的采购可以标记为已下单');
    }

    await this.purchaseRepo.update(id, {
      status: PurchaseStatus.ORDERED,
    });

    await this.auditLogsService.log({
      action: AuditAction.ORDER_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material_purchase',
      detail: `标记物料采购「${existing.itemName}」已下单`,
      metadata: { itemName: existing.itemName },
    });

    return this.findOnePurchase(id);
  }

  async markPurchaseReceived(id: number, operatorId: number, operatorName: string) {
    const existing = await this.purchaseRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('采购记录不存在');

    if (existing.status !== PurchaseStatus.ORDERED) {
      throw new BadRequestException('只有已下单的采购可以标记为已收货');
    }

    await this.purchaseRepo.update(id, {
      status: PurchaseStatus.RECEIVED,
      receivedBy: operatorId,
      receivedAt: new Date(),
    });

    await this.auditLogsService.log({
      action: AuditAction.RECEIVE_MATERIAL_PURCHASE,
      module: AuditModule.MATERIAL_PURCHASE,
      operatorId,
      operatorName,
      targetId: id,
      targetType: 'material_purchase',
      detail: `标记物料采购「${existing.itemName}」已收货`,
      metadata: { itemName: existing.itemName },
    });

    return this.findOnePurchase(id);
  }

  async getStatistics(filters?: {
    startDate?: string;
    endDate?: string;
    performanceId?: number;
  }) {
    const reimbursements = await this.reimbursementRepo.find();
    const purchases = await this.purchaseRepo.find();
    const categories = await this.categoryRepo.find();

    let filteredReimbursements = [...reimbursements];
    let filteredPurchases = [...purchases];

    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      filteredReimbursements = filteredReimbursements.filter(
        (r) => r.createdAt >= start && r.createdAt <= end,
      );
      filteredPurchases = filteredPurchases.filter(
        (p) => p.createdAt >= start && p.createdAt <= end,
      );
    }

    if (filters?.performanceId) {
      filteredReimbursements = filteredReimbursements.filter(
        (r) => r.performanceId === filters.performanceId,
      );
      filteredPurchases = filteredPurchases.filter(
        (p) => p.performanceId === filters.performanceId,
      );
    }

    const parseAmount = (val: any) => parseFloat(val) || 0;

    const totalReimbursementAmount = filteredReimbursements.reduce(
      (sum, r) => sum + parseAmount(r.amount),
      0,
    );
    const approvedReimbursementAmount = filteredReimbursements
      .filter((r) => r.status === ReimbursementStatus.APPROVED || r.status === ReimbursementStatus.PAID)
      .reduce((sum, r) => sum + parseAmount(r.amount), 0);
    const pendingReimbursementAmount = filteredReimbursements
      .filter((r) => r.status === ReimbursementStatus.PENDING)
      .reduce((sum, r) => sum + parseAmount(r.amount), 0);

    const totalPurchaseAmount = filteredPurchases.reduce(
      (sum, p) => sum + parseAmount(p.totalPrice),
      0,
    );
    const approvedPurchaseAmount = filteredPurchases
      .filter((p) => p.status === PurchaseStatus.APPROVED || p.status === PurchaseStatus.ORDERED || p.status === PurchaseStatus.RECEIVED)
      .reduce((sum, p) => sum + parseAmount(p.totalPrice), 0);
    const pendingPurchaseAmount = filteredPurchases
      .filter((p) => p.status === PurchaseStatus.PENDING)
      .reduce((sum, p) => sum + parseAmount(p.totalPrice), 0);

    const byCategory = categories.map((cat) => {
      const catReimbursements = filteredReimbursements.filter((r) => r.categoryId === cat.id);
      const catPurchases = filteredPurchases.filter((p) => p.categoryId === cat.id);
      const reimbursementTotal = catReimbursements.reduce((sum, r) => sum + parseAmount(r.amount), 0);
      const purchaseTotal = catPurchases.reduce((sum, p) => sum + parseAmount(p.totalPrice), 0);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        reimbursementCount: catReimbursements.length,
        reimbursementTotal,
        purchaseCount: catPurchases.length,
        purchaseTotal,
        total: reimbursementTotal + purchaseTotal,
      };
    });

    const reimbursementByStatus = {
      pending: filteredReimbursements.filter((r) => r.status === ReimbursementStatus.PENDING).length,
      approved: filteredReimbursements.filter((r) => r.status === ReimbursementStatus.APPROVED).length,
      rejected: filteredReimbursements.filter((r) => r.status === ReimbursementStatus.REJECTED).length,
      paid: filteredReimbursements.filter((r) => r.status === ReimbursementStatus.PAID).length,
    };

    const purchaseByStatus = {
      pending: filteredPurchases.filter((p) => p.status === PurchaseStatus.PENDING).length,
      approved: filteredPurchases.filter((p) => p.status === PurchaseStatus.APPROVED).length,
      rejected: filteredPurchases.filter((p) => p.status === PurchaseStatus.REJECTED).length,
      ordered: filteredPurchases.filter((p) => p.status === PurchaseStatus.ORDERED).length,
      received: filteredPurchases.filter((p) => p.status === PurchaseStatus.RECEIVED).length,
    };

    return {
      totalBudget: totalReimbursementAmount + totalPurchaseAmount,
      approvedTotal: approvedReimbursementAmount + approvedPurchaseAmount,
      pendingTotal: pendingReimbursementAmount + pendingPurchaseAmount,
      reimbursements: {
        total: filteredReimbursements.length,
        totalAmount: totalReimbursementAmount,
        approvedAmount: approvedReimbursementAmount,
        pendingAmount: pendingReimbursementAmount,
        byStatus: reimbursementByStatus,
      },
      purchases: {
        total: filteredPurchases.length,
        totalAmount: totalPurchaseAmount,
        approvedAmount: approvedPurchaseAmount,
        pendingAmount: pendingPurchaseAmount,
        byStatus: purchaseByStatus,
      },
      byCategory,
    };
  }

  async exportData(type: 'reimbursements' | 'purchases' | 'all', filters?: any) {
    let reimbursements: any[] = [];
    let purchases: any[] = [];
    const categories = await this.categoryRepo.find();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    if (type === 'reimbursements' || type === 'all') {
      reimbursements = await this.findAllReimbursements(filters);
    }
    if (type === 'purchases' || type === 'all') {
      purchases = await this.findAllPurchases(filters);
    }

    const parseAmount = (val: any) => parseFloat(val) || 0;

    let csv = '';

    if (reimbursements.length > 0) {
      csv += '报销记录\n';
      csv += 'ID,标题,分类,金额,状态,申请人,演出,创建时间,审批时间,付款时间\n';
      reimbursements.forEach((r) => {
        csv += [
          r.id,
          `"${r.title}"`,
          categoryMap.get(r.categoryId) || '未分类',
          parseAmount(r.amount).toFixed(2),
          this.getStatusText(r.status, 'reimbursement'),
          r.applicantName || '',
          r.performanceName || '',
          r.createdAt?.toISOString().slice(0, 10) || '',
          r.reviewedAt?.toISOString().slice(0, 10) || '',
          r.paidAt?.toISOString().slice(0, 10) || '',
        ].join(',') + '\n';
      });
      csv += '\n';
    }

    if (purchases.length > 0) {
      csv += '物料采购\n';
      csv += 'ID,物品名称,分类,数量,单价,总价,供应商,状态,申请人,演出,创建时间,审批时间,收货时间\n';
      purchases.forEach((p) => {
        csv += [
          p.id,
          `"${p.itemName}"`,
          categoryMap.get(p.categoryId) || '未分类',
          p.quantity,
          parseAmount(p.unitPrice).toFixed(2),
          parseAmount(p.totalPrice).toFixed(2),
          `"${p.supplier || ''}"`,
          this.getStatusText(p.status, 'purchase'),
          p.requesterName || '',
          p.performanceName || '',
          p.createdAt?.toISOString().slice(0, 10) || '',
          p.reviewedAt?.toISOString().slice(0, 10) || '',
          p.receivedAt?.toISOString().slice(0, 10) || '',
        ].join(',') + '\n';
      });
      csv += '\n';
    }

    if (type === 'all') {
      const stats = await this.getStatistics(filters);
      csv += '\n统计汇总\n';
      csv += '指标,数值\n';
      csv += `总预算,${stats.totalBudget.toFixed(2)}\n`;
      csv += `已批准金额,${stats.approvedTotal.toFixed(2)}\n`;
      csv += `待审批金额,${stats.pendingTotal.toFixed(2)}\n`;
      csv += `报销总数,${stats.reimbursements.total}\n`;
      csv += `报销总金额,${stats.reimbursements.totalAmount.toFixed(2)}\n`;
      csv += `采购总数,${stats.purchases.total}\n`;
      csv += `采购总金额,${stats.purchases.totalAmount.toFixed(2)}\n`;
    }

    return { csv, type, count: reimbursements.length + purchases.length };
  }

  private getStatusText(status: string, type: 'reimbursement' | 'purchase'): string {
    if (type === 'reimbursement') {
      const map: Record<string, string> = {
        pending: '待审批',
        approved: '已批准',
        rejected: '已驳回',
        paid: '已付款',
      };
      return map[status] || status;
    } else {
      const map: Record<string, string> = {
        pending: '待审批',
        approved: '已批准',
        rejected: '已驳回',
        ordered: '已下单',
        received: '已收货',
      };
      return map[status] || status;
    }
  }

  private async enrichReimbursements(items: Reimbursement[]): Promise<any[]> {
    const userIds = new Set<number>();
    const performanceIds = new Set<number>();
    const categoryIds = new Set<number>();

    items.forEach((r) => {
      if (r.applicantId) userIds.add(r.applicantId);
      if (r.reviewedBy) userIds.add(r.reviewedBy);
      if (r.paidBy) userIds.add(r.paidBy);
      if (r.createdBy) userIds.add(r.createdBy);
      if (r.performanceId) performanceIds.add(r.performanceId);
      if (r.categoryId) categoryIds.add(r.categoryId);
    });

    const [users, performances, categories] = await Promise.all([
      this.userRepo.findByIds(Array.from(userIds)),
      this.performanceRepo.findByIds(Array.from(performanceIds)),
      this.categoryRepo.findByIds(Array.from(categoryIds)),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const performanceMap = new Map(performances.map((p) => [p.id, p]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    return items.map((r) => ({
      ...r,
      amount: parseFloat(r.amount as any) || 0,
      applicantName: userMap.get(r.applicantId)?.displayName || userMap.get(r.applicantId)?.username,
      reviewerName: r.reviewedBy
        ? userMap.get(r.reviewedBy)?.displayName || userMap.get(r.reviewedBy)?.username
        : null,
      payerName: r.paidBy
        ? userMap.get(r.paidBy)?.displayName || userMap.get(r.paidBy)?.username
        : null,
      creatorName: r.createdBy
        ? userMap.get(r.createdBy)?.displayName || userMap.get(r.createdBy)?.username
        : null,
      performanceName: r.performanceId ? (performanceMap.get(r.performanceId) as any)?.title : null,
      categoryName: r.categoryId ? categoryMap.get(r.categoryId)?.name : null,
    }));
  }

  private async enrichPurchases(items: MaterialPurchase[]): Promise<any[]> {
    const userIds = new Set<number>();
    const performanceIds = new Set<number>();
    const categoryIds = new Set<number>();

    items.forEach((p) => {
      if (p.requesterId) userIds.add(p.requesterId);
      if (p.reviewedBy) userIds.add(p.reviewedBy);
      if (p.receivedBy) userIds.add(p.receivedBy);
      if (p.createdBy) userIds.add(p.createdBy);
      if (p.performanceId) performanceIds.add(p.performanceId);
      if (p.categoryId) categoryIds.add(p.categoryId);
    });

    const [users, performances, categories] = await Promise.all([
      this.userRepo.findByIds(Array.from(userIds)),
      this.performanceRepo.findByIds(Array.from(performanceIds)),
      this.categoryRepo.findByIds(Array.from(categoryIds)),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const performanceMap = new Map(performances.map((p) => [p.id, p]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    return items.map((p) => ({
      ...p,
      unitPrice: parseFloat(p.unitPrice as any) || 0,
      totalPrice: parseFloat(p.totalPrice as any) || 0,
      requesterName: userMap.get(p.requesterId)?.displayName || userMap.get(p.requesterId)?.username,
      reviewerName: p.reviewedBy
        ? userMap.get(p.reviewedBy)?.displayName || userMap.get(p.reviewedBy)?.username
        : null,
      receiverName: p.receivedBy
        ? userMap.get(p.receivedBy)?.displayName || userMap.get(p.receivedBy)?.username
        : null,
      creatorName: p.createdBy
        ? userMap.get(p.createdBy)?.displayName || userMap.get(p.createdBy)?.username
        : null,
      performanceName: p.performanceId ? (performanceMap.get(p.performanceId) as any)?.title : null,
      categoryName: p.categoryId ? categoryMap.get(p.categoryId)?.name : null,
    }));
  }
}
