import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rehearsal } from '../entities';

@Injectable()
export class RehearsalsService {
  constructor(
    @InjectRepository(Rehearsal)
    private repo: Repository<Rehearsal>,
  ) {}

  async create(data: Partial<Rehearsal>) {
    const item = this.repo.create(data);
    return this.repo.save(item);
  }

  async findAll() {
    return this.repo.find({ order: { startTime: 'ASC' } });
  }

  async findByDateRange(start: string, end: string) {
    return this.repo.find({
      where: [
        { startTime: new Date(start) },
      ],
      order: { startTime: 'ASC' },
    });
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Rehearsal>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }
}
