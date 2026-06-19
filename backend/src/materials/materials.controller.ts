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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Material } from '../entities';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private service: MaterialsService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('categories') categories?: string,
    @Query('tags') tags?: string,
    @Query('keyword') keyword?: string,
  ) {
    if (category && !categories) {
      return this.service.findByCategory(category);
    }
    return this.service.findAll({ categories, tags, keyword });
  }

  @Get('meta/categories')
  getCategories() {
    return this.service.getAllCategories();
  }

  @Get('meta/tags')
  getTags() {
    return this.service.getAllTags();
  }

  @Get(':id/download')
  async download(@Param('id') id: number, @Request() req: any, @Res() res: Response) {
    const material = await this.service.findOne(id);
    if (!material) {
      return res.status(404).json({ message: '文件不存在' });
    }
    const canDl = await this.service.canDownload(id, req.user.role);
    if (!canDl) {
      return res.status(403).json({ message: '无下载权限' });
    }
    const filePath = join(UPLOAD_DIR, material.storedName);
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: '文件已被删除' });
    }
    return res.download(filePath, material.originalName);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(UPLOAD_DIR)) {
            mkdirSync(UPLOAD_DIR, { recursive: true });
          }
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
    @Query('category') category?: string,
    @Query('description') description?: string,
    @Query('categories') categoriesStr?: string,
    @Query('tags') tagsStr?: string,
    @Query('downloadRoles') downloadRolesStr?: string,
  ) {
    const parsedCategories = categoriesStr ? categoriesStr.split(',').map((c) => c.trim()).filter(Boolean) : [];
    const parsedTags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const parsedDownloadRoles = downloadRolesStr ? downloadRolesStr.split(',').map((r) => r.trim()).filter(Boolean) : [];

    return this.service.create({
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      category: category || 'general',
      categories: parsedCategories.length > 0 ? parsedCategories : (category ? [category] : ['general']),
      tags: parsedTags,
      downloadRoles: parsedDownloadRoles,
      description: description || '',
      createdBy: req.user.userId,
    });
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async update(@Param('id') id: number, @Body() body: Partial<Material>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
