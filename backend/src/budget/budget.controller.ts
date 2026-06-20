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
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { BudgetService } from './budget.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, ReimbursementStatus, PurchaseStatus } from '../entities';

@Controller('budget')
@UseGuards(JwtAuthGuard)
export class BudgetController {
  constructor(private service: BudgetService) {}

  @Get('categories')
  findAllCategories(@Query('onlyActive') onlyActive?: string) {
    return this.service.findAllCategories(onlyActive === 'true');
  }

  @Get('categories/:id')
  findOneCategory(@Param('id') id: number) {
    try {
      return this.service.findOneCategory(id);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  createCategory(
    @Body()
    body: {
      name: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    @Request() req: any,
  ) {
    return this.service.createCategory(body, req.user.userId, req.user.username);
  }

  @Put('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateCategory(
    @Param('id') id: number,
    @Body()
    body: {
      name?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    @Request() req: any,
  ) {
    try {
      return this.service.updateCategory(id, body, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removeCategory(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.removeCategory(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('reimbursements')
  findAllReimbursements(
    @Query('status') status?: ReimbursementStatus,
    @Query('categoryId') categoryId?: string,
    @Query('applicantId') applicantId?: string,
    @Query('performanceId') performanceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAllReimbursements({
      status,
      categoryId: categoryId ? Number(categoryId) : undefined,
      applicantId: applicantId ? Number(applicantId) : undefined,
      performanceId: performanceId ? Number(performanceId) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('reimbursements/:id')
  findOneReimbursement(@Param('id') id: number) {
    try {
      return this.service.findOneReimbursement(id);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post('reimbursements')
  createReimbursement(
    @Body()
    body: {
      title: string;
      description?: string;
      categoryId: number;
      amount: number;
      attachments?: string[];
      performanceId?: number;
    },
    @Request() req: any,
  ) {
    return this.service.createReimbursement(body, req.user.userId, req.user.username);
  }

  @Put('reimbursements/:id')
  updateReimbursement(
    @Param('id') id: number,
    @Body()
    body: {
      title?: string;
      description?: string;
      categoryId?: number;
      amount?: number;
      attachments?: string[];
      performanceId?: number;
    },
    @Request() req: any,
  ) {
    try {
      return this.service.updateReimbursement(id, body, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('reimbursements/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removeReimbursement(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.removeReimbursement(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('reimbursements/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  approveReimbursement(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.approveReimbursement(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('reimbursements/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  rejectReimbursement(
    @Param('id') id: number,
    @Body() body: { rejectionReason: string },
    @Request() req: any,
  ) {
    try {
      return this.service.rejectReimbursement(
        id,
        body.rejectionReason,
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('reimbursements/:id/pay')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  markReimbursementPaid(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.markReimbursementPaid(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('purchases')
  findAllPurchases(
    @Query('status') status?: PurchaseStatus,
    @Query('categoryId') categoryId?: string,
    @Query('requesterId') requesterId?: string,
    @Query('performanceId') performanceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAllPurchases({
      status,
      categoryId: categoryId ? Number(categoryId) : undefined,
      requesterId: requesterId ? Number(requesterId) : undefined,
      performanceId: performanceId ? Number(performanceId) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('purchases/:id')
  findOnePurchase(@Param('id') id: number) {
    try {
      return this.service.findOnePurchase(id);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post('purchases')
  createPurchase(
    @Body()
    body: {
      itemName: string;
      description?: string;
      categoryId: number;
      quantity: number;
      unitPrice: number;
      supplier?: string;
      attachments?: string[];
      performanceId?: number;
    },
    @Request() req: any,
  ) {
    return this.service.createPurchase(body, req.user.userId, req.user.username);
  }

  @Put('purchases/:id')
  updatePurchase(
    @Param('id') id: number,
    @Body()
    body: {
      itemName?: string;
      description?: string;
      categoryId?: number;
      quantity?: number;
      unitPrice?: number;
      supplier?: string;
      attachments?: string[];
      performanceId?: number;
    },
    @Request() req: any,
  ) {
    try {
      return this.service.updatePurchase(id, body, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('purchases/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  removePurchase(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.removePurchase(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('purchases/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  approvePurchase(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.approvePurchase(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('purchases/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  rejectPurchase(
    @Param('id') id: number,
    @Body() body: { rejectionReason: string },
    @Request() req: any,
  ) {
    try {
      return this.service.rejectPurchase(
        id,
        body.rejectionReason,
        req.user.userId,
        req.user.username,
      );
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('purchases/:id/order')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  markPurchaseOrdered(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.markPurchaseOrdered(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('purchases/:id/receive')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  markPurchaseReceived(@Param('id') id: number, @Request() req: any) {
    try {
      return this.service.markPurchaseReceived(id, req.user.userId, req.user.username);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('statistics')
  getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('performanceId') performanceId?: string,
  ) {
    return this.service.getStatistics({
      startDate,
      endDate,
      performanceId: performanceId ? Number(performanceId) : undefined,
    });
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async exportData(
    @Res() res: Response,
    @Query('type') type: 'reimbursements' | 'purchases' | 'all' = 'all',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('performanceId') performanceId?: string,
  ) {
    const result = await this.service.exportData(type, {
      startDate,
      endDate,
      performanceId: performanceId ? Number(performanceId) : undefined,
    });

    const filename = `budget-export-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + result.csv);
  }
}
