import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from '../entities';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const result = await this.authService.login(body.username, body.password);
    if (!result) {
      return { success: false, message: '用户名或密码错误' };
    }
    return { success: true, ...result };
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  async register(
    @Body() body: { username: string; password: string; role: UserRole; displayName?: string },
    @Request() req: any,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      return { success: false, message: '仅管理员可创建用户' };
    }
    const user = await this.authService.register(body.username, body.password, body.role, body.displayName);
    if (!user) {
      return { success: false, message: '用户名已存在' };
    }
    return { success: true, user: { id: user.id, username: user.username, role: user.role } };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return req.user;
  }
}
