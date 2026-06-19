import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CastRole } from '../entities';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(CastRole)
    private repo: Repository<CastRole>,
  ) {}

  async create(data: Partial<CastRole>) {
    const item = this.repo.create(data);
    return this.repo.save(item);
  }

  async findAll() {
    return this.repo.find({ order: { priority: 'ASC' } });
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<CastRole>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
