import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation } from '../entities';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private repo: Repository<Annotation>,
  ) {}

  async create(data: Partial<Annotation>) {
    const item = this.repo.create(data);
    return this.repo.save(item);
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByScene(sceneNumber: number) {
    return this.repo.find({ where: { sceneNumber }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Annotation>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
