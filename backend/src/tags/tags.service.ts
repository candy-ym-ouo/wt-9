import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Tag, TagCategory, TagRelation, TagTargetType } from '../entities';
import { DramasService } from '../dramas/dramas.service';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagRepo: Repository<Tag>,
    @InjectRepository(TagRelation)
    private relationRepo: Repository<TagRelation>,
    private dramasService: DramasService,
  ) {}

  async create(data: Partial<Tag>, operatorId: number) {
    if (data.dramaId) {
      await this.dramasService.checkAccess(data.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }
    const tag = this.tagRepo.create({ ...data, createdBy: operatorId });
    return this.tagRepo.save(tag);
  }

  async findAll(dramaId: number | undefined, category?: TagCategory, userId?: number) {
    if (dramaId && userId) {
      await this.dramasService.checkAccess(dramaId, userId, ['viewer']);
    }
    const where: any = {};
    if (dramaId) where.dramaId = dramaId;
    if (category) where.categories = JSON.stringify([category]);
    const tags = await this.tagRepo.find({ where, order: { name: 'ASC' } });
    if (category) {
      return tags.filter((t) => (t.categories || []).includes(category));
    }
    return tags;
  }

  async findOne(id: number) {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('标签不存在');
    return tag;
  }

  async update(id: number, data: Partial<Tag>, operatorId: number) {
    const tag = await this.findOne(id);
    if (tag.dramaId) {
      await this.dramasService.checkAccess(tag.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }
    await this.tagRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number, operatorId: number) {
    const tag = await this.findOne(id);
    if (tag.dramaId) {
      await this.dramasService.checkAccess(tag.dramaId, operatorId, ['owner', 'director']);
    }
    await this.relationRepo.delete({ tagId: id });
    return this.tagRepo.delete(id);
  }

  async attachTags(
    tagIds: number[],
    targetType: TagTargetType,
    targetId: number,
    dramaId: number | undefined,
    operatorId: number,
  ) {
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }
    await this.relationRepo.delete({ targetType, targetId });
    const relations = tagIds.map((tagId) =>
      this.relationRepo.create({ tagId, targetType, targetId, dramaId }),
    );
    if (relations.length > 0) {
      return this.relationRepo.save(relations);
    }
    return [];
  }

  async detachTag(tagId: number, targetType: TagTargetType, targetId: number, operatorId: number) {
    const tag = await this.findOne(tagId);
    if (tag.dramaId) {
      await this.dramasService.checkAccess(tag.dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }
    return this.relationRepo.delete({ tagId, targetType, targetId });
  }

  async getTagsForTarget(targetType: TagTargetType, targetId: number) {
    const relations = await this.relationRepo.find({ where: { targetType, targetId } });
    if (relations.length === 0) return [];
    const tagIds = relations.map((r) => r.tagId);
    return this.tagRepo.find({ where: { id: In(tagIds) } });
  }

  async getTargetsForTag(tagId: number, targetType?: TagTargetType) {
    const where: any = { tagId };
    if (targetType) where.targetType = targetType;
    return this.relationRepo.find({ where });
  }

  async filterByTags(
    tagIds: number[],
    targetType: TagTargetType,
    dramaId?: number,
  ) {
    const queryBuilder = this.relationRepo
      .createQueryBuilder('tr')
      .where('tr.tagId IN (:...tagIds)', { tagIds })
      .andWhere('tr.targetType = :targetType', { targetType });

    if (dramaId) {
      queryBuilder.andWhere('tr.dramaId = :dramaId', { dramaId });
    }

    const relations = await queryBuilder.getMany();

    const targetIdCount: Record<number, number> = {};
    relations.forEach((r) => {
      targetIdCount[r.targetId] = (targetIdCount[r.targetId] || 0) + 1;
    });

    return Object.entries(targetIdCount)
      .filter(([, count]) => count === tagIds.length)
      .map(([id]) => Number(id));
  }

  async getStatistics(dramaId?: number) {
    const where: any = {};
    if (dramaId) where.dramaId = dramaId;

    const tags = await this.tagRepo.find({ where: { ...where } });
    const tagIds = tags.map((t) => t.id);

    const allRelations = tagIds.length > 0
      ? await this.relationRepo.find({ where: { tagId: In(tagIds) } })
      : [];

    const byCategory: Record<string, number> = {};
    tags.forEach((t) => {
      (t.categories || []).forEach((cat) => {
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });
    });

    const byTargetType: Record<string, number> = {};
    allRelations.forEach((r) => {
      byTargetType[r.targetType] = (byTargetType[r.targetType] || 0) + 1;
    });

    const tagUsageCounts = allRelations.reduce<Record<number, number>>((acc, r) => {
      acc[r.tagId] = (acc[r.tagId] || 0) + 1;
      return acc;
    }, {});

    const topTags = tags
      .map((t) => ({ ...t, usageCount: tagUsageCounts[t.id] || 0 }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20);

    return {
      totalTags: tags.length,
      totalRelations: allRelations.length,
      byCategory,
      byTargetType,
      topTags,
    };
  }

  async batchAttachTags(
    items: Array<{ tagIds: number[]; targetType: TagTargetType; targetId: number }>,
    dramaId: number | undefined,
    operatorId: number,
  ) {
    if (dramaId) {
      await this.dramasService.checkAccess(dramaId, operatorId, ['owner', 'director', 'assistant_director']);
    }

    const allRelations: TagRelation[] = [];
    for (const item of items) {
      await this.relationRepo.delete({ targetType: item.targetType, targetId: item.targetId });
      const relations = item.tagIds.map((tagId) =>
        this.relationRepo.create({ tagId, targetType: item.targetType, targetId: item.targetId, dramaId }),
      );
      if (relations.length > 0) {
        allRelations.push(...relations);
      }
    }
    if (allRelations.length > 0) {
      return this.relationRepo.save(allRelations);
    }
    return [];
  }
}
