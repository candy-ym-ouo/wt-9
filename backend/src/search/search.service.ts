import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Rehearsal, CastRole, Annotation, Material } from '../entities';
import { RehearsalsService } from '../rehearsals/rehearsals.service';
import { RolesService } from '../roles/roles.service';
import { AnnotationsService } from '../annotations/annotations.service';

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
    private rehearsalsService: RehearsalsService,
    private rolesService: RolesService,
    private annotationsService: AnnotationsService,
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

    const rehearsalsWithConflicts = await this.rehearsalsService.enrichWithConflictInfo(rehearsals);
    const rehearsalsWithParticipants = await this.rehearsalsService.enrichWithParticipantInfo(rehearsals);
    const enrichedRehearsals = rehearsalsWithConflicts.map((r, i) => ({
      ...r,
      ...rehearsalsWithParticipants[i],
    }));

    const roleIds = roles.map((r) => r.id);
    const enrichedRoles: any[] = [];
    for (const roleId of roleIds) {
      const roleDetail = await this.rolesService.findOne(roleId);
      if (roleDetail) {
        enrichedRoles.push(roleDetail);
      }
    }

    const highlightedAnnotations = this.annotationsService.searchInScript(query, annotations);

    return {
      rehearsals: enrichedRehearsals,
      roles: enrichedRoles,
      annotations: highlightedAnnotations,
      materials,
      total: rehearsals.length + roles.length + annotations.length + materials.length,
    };
  }
}
