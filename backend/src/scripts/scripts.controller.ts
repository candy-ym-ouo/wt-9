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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScriptsService } from './scripts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScriptStatus, ScriptFormat, UserRole } from '../entities';

@Controller('scripts')
@UseGuards(JwtAuthGuard)
export class ScriptsController {
  constructor(private service: ScriptsService) {}

  @Get()
  findAll(
    @Query()
    query: {
      keyword?: string;
      status?: ScriptStatus;
      tags?: string;
      author?: string;
    },
  ) {
    return this.service.findAll(query);
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('scriptId') scriptId?: string,
  ) {
    return this.service.fullTextSearch(q, scriptId ? parseInt(scriptId, 10) : undefined);
  }

  @Get('tags')
  getAllTags() {
    return this.service.getAllTags();
  }

  @Get('authors')
  getAllAuthors() {
    return this.service.getAllAuthors();
  }

  @Get('characters')
  getAllCharacterNames(@Query('scriptId') scriptId?: string) {
    return this.service.getAllCharacterNames(scriptId ? parseInt(scriptId, 10) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/structure')
  getStructure(@Param('id') id: number) {
    return this.service.findOneWithStructure(id);
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: number) {
    return this.service.getVersions(id);
  }

  @Get(':id/versions/:versionId')
  getVersion(@Param('id') id: number, @Param('versionId') versionId: number) {
    return this.service.getVersion(id, versionId);
  }

  @Get(':id/annotations')
  getAnnotations(@Param('id') id: number) {
    return this.service.getScriptAnnotations(id);
  }

  @Get(':id/annotations/grouped')
  getAnnotationsGrouped(@Param('id') id: number) {
    return this.service.getAnnotationsGroupedByScene(id);
  }

  @Get(':id/chapters/:chapterId')
  getChapter(@Param('id') id: number, @Param('chapterId') chapterId: number) {
    return this.service.getChapter(id, chapterId);
  }

  @Get(':id/chapters/:chapterId/annotations')
  getChapterAnnotations(@Param('id') id: number, @Param('chapterId') chapterId: number) {
    return this.service.getChapterAnnotations(id, chapterId);
  }

  @Get(':id/scenes/:sceneId')
  getScene(@Param('id') id: number, @Param('sceneId') sceneId: number) {
    return this.service.getScene(id, sceneId);
  }

  @Get(':id/scenes/:sceneId/annotations')
  getSceneAnnotations(@Param('id') id: number, @Param('sceneId') sceneId: number) {
    return this.service.getSceneAnnotations(id, sceneId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  create(
    @Body()
    body: {
      title: string;
      originalTitle?: string;
      author?: string;
      translator?: string;
      description?: string;
      synopsis?: string;
      genre?: string[];
      estimatedDuration?: number;
      rawContent: string;
      parsedContent?: string;
      tags?: string[];
      chapters?: any[];
      scenes?: any[];
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        ...body,
        format: ScriptFormat.PLAIN_TEXT,
        status: ScriptStatus.DRAFT,
      },
      req.user.userId,
      req.user.username,
    );
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  uploadScript(
    @Body()
    body: {
      title: string;
      content: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      format?: ScriptFormat;
      author?: string;
      description?: string;
      autoParse?: boolean;
    },
    @Request() req: any,
  ) {
    return this.service.uploadScript(body, req.user.userId, req.user.username);
  }

  @Post(':id/reparse')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  reparseScript(@Param('id') id: number, @Request() req: any) {
    return this.service.reparseScript(id, req.user.userId, req.user.username);
  }

  @Post(':id/versions/:versionId/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  restoreVersion(
    @Param('id') id: number,
    @Param('versionId') versionId: number,
    @Request() req: any,
  ) {
    return this.service.restoreToVersion(id, versionId, req.user.userId, req.user.username);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  publish(@Param('id') id: number, @Request() req: any) {
    return this.service.publish(id, req.user.userId, req.user.username);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  archive(@Param('id') id: number, @Request() req: any) {
    return this.service.archive(id, req.user.userId, req.user.username);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  update(
    @Param('id') id: number,
    @Body()
    body: {
      title?: string;
      originalTitle?: string;
      author?: string;
      translator?: string;
      description?: string;
      synopsis?: string;
      genre?: string[];
      estimatedDuration?: number;
      status?: ScriptStatus;
      rawContent?: string;
      parsedContent?: string;
      tags?: string[];
      characterNames?: string[];
      changeNote?: string;
    },
    @Request() req: any,
  ) {
    const { changeNote, ...data } = body;
    return this.service.update(id, data, req.user.userId, req.user.username, changeNote);
  }

  @Put(':id/chapters/:chapterId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateChapter(
    @Param('id') id: number,
    @Param('chapterId') chapterId: number,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.updateChapter(id, chapterId, body, req.user.userId, req.user.username);
  }

  @Put(':id/scenes/:sceneId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  updateScene(
    @Param('id') id: number,
    @Param('sceneId') sceneId: number,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.service.updateScene(id, sceneId, body, req.user.userId, req.user.username);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number, @Request() req: any) {
    return this.service.remove(id, req.user.userId, req.user.username);
  }
}
