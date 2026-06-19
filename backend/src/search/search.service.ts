import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Rehearsal, CastRole, Annotation, Material } from '../entities';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Rehearsal)
    private rehearsalRepo: Repository<Rehearsal>,
    @InjectRepository(CastRole)
    private roleRepo: Repository<CastRole>,
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
  ) {}

  async search(query: string) {
    const likeQuery = `%${query}%`;
    const [rehearsals, roles, annotations, materials] = await Promise.all([
      this.rehearsalRepo.find({
        where: [
          { title: Like(likeQuery) },
          { description: Like(likeQuery) },
          { location: Like(likeQuery) },
        ],
      }),
      this.roleRepo.find({
        where: [
          { characterName: Like(likeQuery) },
          { characterDescription: Like(likeQuery) },
        ],
      }),
      this.annotationRepo.find({
        where: [
          { scriptContent: Like(likeQuery) },
          { note: Like(likeQuery) },
          { tag: Like(likeQuery) },
        ],
      }),
      this.materialRepo.find({
        where: [
          { originalName: Like(likeQuery) },
          { description: Like(likeQuery) },
          { category: Like(likeQuery) },
        ],
      }),
    ]);

    return {
      rehearsals,
      roles,
      annotations,
      materials,
      total: rehearsals.length + roles.length + annotations.length + materials.length,
    };
  }
}
