import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from '../entities';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private repo: Repository<Material>,
  ) {}

  async create(data: Partial<Material>) {
    const item = this.repo.create(data);
    return this.repo.save(item);
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCategory(category: string) {
    return this.repo.find({ where: { category }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
