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
    if (!item.categories || item.categories.length === 0) {
      item.categories = item.category ? [item.category] : ['general'];
    }
    if (!item.tags) item.tags = [];
    if (!item.downloadRoles) item.downloadRoles = [];
    return this.repo.save(item);
  }

  async findAll(params?: { categories?: string; tags?: string; keyword?: string }) {
    let qb = this.repo.createQueryBuilder('m').orderBy('m.createdAt', 'DESC');

    if (params?.categories) {
      const cats = params.categories.split(',').map((c) => c.trim()).filter(Boolean);
      if (cats.length > 0) {
        const conditions = cats.map((_, i) => `m.categories LIKE :cat${i}`).join(' OR ');
        const catParams: Record<string, string> = {};
        cats.forEach((c, i) => { catParams[`cat${i}`] = `%"${c}"%`; });
        qb = qb.andWhere(`(${conditions})`, catParams);
      }
    }

    if (params?.tags) {
      const tagList = params.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const conditions = tagList.map((_, i) => `m.tags LIKE :tag${i}`).join(' OR ');
        const tagParams: Record<string, string> = {};
        tagList.forEach((t, i) => { tagParams[`tag${i}`] = `%"${t}"%`; });
        qb = qb.andWhere(`(${conditions})`, tagParams);
      }
    }

    if (params?.keyword) {
      qb = qb.andWhere(
        '(m.originalName LIKE :kw OR m.description LIKE :kw)',
        { kw: `%${params.keyword}%` },
      );
    }

    return qb.getMany();
  }

  async findByCategory(category: string) {
    return this.repo
      .createQueryBuilder('m')
      .where('m.categories LIKE :cat', { cat: `%"${category}"%` })
      .orWhere('m.category = :category', { category })
      .orderBy('m.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async canDownload(materialId: number, userRole: string): Promise<boolean> {
    const material = await this.findOne(materialId);
    if (!material) return false;
    if (!material.downloadRoles || material.downloadRoles.length === 0) return true;
    return material.downloadRoles.includes(userRole);
  }

  async update(id: number, data: Partial<Material>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.repo.delete(id);
  }

  async getAllCategories(): Promise<string[]> {
    const materials = await this.repo.find();
    const catSet = new Set<string>();
    materials.forEach((m) => {
      if (m.categories) m.categories.forEach((c) => catSet.add(c));
      if (m.category) catSet.add(m.category);
    });
    return Array.from(catSet).sort();
  }

  async getAllTags(): Promise<string[]> {
    const materials = await this.repo.find();
    const tagSet = new Set<string>();
    materials.forEach((m) => {
      if (m.tags) m.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }
}
