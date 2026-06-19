import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { User, Rehearsal, CastRole, Annotation, Material } from './entities';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';
import { RolesModule } from './roles/roles.module';
import { AnnotationsModule } from './annotations/annotations.module';
import { MaterialsModule } from './materials/materials.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(process.cwd(), 'theater.db'),
      entities: [User, Rehearsal, CastRole, Annotation, Material],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    RehearsalsModule,
    RolesModule,
    AnnotationsModule,
    MaterialsModule,
    SearchModule,
  ],
})
export class AppModule {}
