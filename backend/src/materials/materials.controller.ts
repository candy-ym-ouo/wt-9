import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
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
import { UserRole } from '../entities';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private service: MaterialsService) {}

  @Get()
  findAll(@Query('category') category?: string) {
    if (category) {
      return this.service.findByCategory(category);
    }
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
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
  ) {
    return this.service.create({
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      category: category || 'general',
      description: description || '',
      createdBy: req.user.userId,
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: number, @Res() res: Response) {
    const material = await this.service.findOne(id);
    if (!material) {
      return res.status(404).json({ message: '文件不存在' });
    }
    const filePath = join(UPLOAD_DIR, material.storedName);
    return res.download(filePath, material.originalName);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
