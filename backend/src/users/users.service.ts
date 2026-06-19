import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAll() {
    return this.userRepo.find({ select: ['id', 'username', 'role', 'displayName', 'createdAt'] });
  }

  async findOne(id: number) {
    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName', 'createdAt'] });
  }

  async updateRole(id: number, role: UserRole) {
    await this.userRepo.update(id, { role });
    return this.userRepo.findOne({ where: { id }, select: ['id', 'username', 'role', 'displayName'] });
  }

  async remove(id: number) {
    return this.userRepo.delete(id);
  }
}
