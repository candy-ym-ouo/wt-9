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
import { UserRole, Material, TagTargetType } from '../entities';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { TagsService } from '../tags/tags.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private service: MaterialsService, private tagsService: TagsService) {}

  @Get(':id/tags')
  getMaterialTags(@Param('id') id: number) {
    return this.tagsService.getTagsForTarget(TagTargetType.MATERIAL, id);
  }

  @Get()
  async findAll(
    @Query('dramaId') dramaId: number,
    @Query('category') category?: string,
    @Query('categories') categories?: string,
    @Query('tags') tags?: string,
    @Query('keyword') keyword?: string,
    @Request() req?: any,
  ) {
    let materials: Material[];
    if (category && !categories) {
      materials = await this.service.findByCategory(category, dramaId, req.user.userId);
    } else {
      materials = await this.service.findAll(dramaId, req.user.userId, { categories, tags, keyword });
    }
    return this.service.enrichWithReferenceCounts(materials);
  }

  @Get('cross-drama')
  async findAllCrossDrama(
    @Query('categories') categories?: string,
    @Query('tags') tags?: string,
    @Query('keyword') keyword?: string,
    @Request() req?: any,
  ) {
    const materials = await this.service.findAllCrossDrama(req.user.userId, { categories, tags, keyword });
    return this.service.enrichWithReferenceCounts(materials);
  }

  @Get('meta/categories')
  getCategories(
    @Query('dramaId') dramaId: number,
    @Request() req: any,
  ) {
    return this.service.getAllCategories(dramaId, req.user.userId);
  }

  @Get('meta/tags')
  getTags(
    @Query('dramaId') dramaId: number,
    @Request() req: any,
  ) {
    return this.service.getAllTags(dramaId, req.user.userId);
  }

  @Get('check-duplicate')
  checkDuplicate(
    @Query('filename') filename: string,
    @Query('dramaId') dramaId: number,
  ) {
    if (!filename) {
      return { exists: false, materials: [] };
    }
    return this.service.checkDuplicate(filename, dramaId);
  }

  @Get(':id/references')
  getReferences(@Param('id') id: number, @Request() req: any) {
    return this.service.getReferences(id);
  }

  @Get(':id')
  findOne(@Param('id') id: number, @Request() req: any) {
    return this.service.findOneWithReferences(id, req.user.userId);
  }

  @Get(':id/download')
  async download(@Param('id') id: number, @Request() req: any, @Res() res: Response) {
    const material = await this.service.findOne(id, req.user.userId);
    if (!material) {
      return res.status(404).json({ message: '文件不存在' });
    }
    const canDl = await this.service.canDownload(id, req.user.role, req.user.userId);
    if (!canDl) {
      return res.status(403).json({ message: '无下载权限' });
    }
    const filePath = join(UPLOAD_DIR, material.storedName);
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: '文件已被删除' });
    }
    return res.download(filePath, material.originalName);
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
    @Query('dramaId') dramaIdStr: string,
    @Query('category') category?: string,
    @Query('description') description?: string,
    @Query('categories') categoriesStr?: string,
    @Query('tags') tagsStr?: string,
    @Query('downloadRoles') downloadRolesStr?: string,
    @Query('onDuplicate') onDuplicate?: 'new_version' | 'overwrite',
    @Query('overwriteTargetId') overwriteTargetIdStr?: string,
  ) {
    const dramaId = parseInt(dramaIdStr, 10);
    const parsedCategories = categoriesStr ? categoriesStr.split(',').map((c) => c.trim()).filter(Boolean) : [];
    const parsedTags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const parsedDownloadRoles = downloadRolesStr ? downloadRolesStr.split(',').map((r) => r.trim()).filter(Boolean) : [];
    const overwriteTargetId = overwriteTargetIdStr ? parseInt(overwriteTargetIdStr, 10) : undefined;

    return this.service.create(
      {
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
      },
      dramaId,
      req.user.userId,
      req.user.username,
      onDuplicate,
      overwriteTargetId,
      UPLOAD_DIR,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  async update(@Param('id') id: number, @Body() body: Partial<Material>, @Request() req: any) {
    return this.service.update(id, body, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }
}
