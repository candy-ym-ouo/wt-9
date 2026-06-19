import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    if (!user) {
      return null;
    }
    if (user.status === UserStatus.FROZEN) {
      return { success: false, frozen: true, message: '该账号已被冻结，请联系管理员' };
    }
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      success: true,
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName, status: user.status },
    };
  }

  async register(username: string, password: string, role: UserRole, displayName?: string) {
    const existing = await this.userRepo.findOne({ where: { username } });
    if (existing) {
      return null;
    }
    const user = this.userRepo.create({ username, password, role, displayName });
    return this.userRepo.save(user);
  }
}
