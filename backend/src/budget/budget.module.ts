import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExpenseCategory,
  Reimbursement,
  MaterialPurchase,
  User,
  Performance,
} from '../entities';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseCategory,
      Reimbursement,
      MaterialPurchase,
      User,
      Performance,
    ]),
    AuditLogsModule,
  ],
  providers: [BudgetService],
  controllers: [BudgetController],
  exports: [BudgetService],
})
export class BudgetModule {}
