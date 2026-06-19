import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from './entities';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function seedDefaults(app: any) {
  const userRepo: Repository<User> = app.get(getRepositoryToken(User));

  const defaults: Array<{ username: string; password: string; role: UserRole; displayName: string }> = [
    { username: 'admin', password: 'admin', role: UserRole.ADMIN, displayName: '系统管理员' },
    { username: 'director', password: 'director', role: UserRole.DIRECTOR, displayName: '张导' },
    { username: 'actor', password: 'actor', role: UserRole.ACTOR, displayName: '演员小李' },
  ];

  for (const d of defaults) {
    const existing = await userRepo.findOne({ where: { username: d.username } });
    if (!existing) {
      await userRepo.save(userRepo.create(d));
      console.log(`✅ 默认用户已创建: ${d.username} / ${d.password} (${d.role})`);
    }
  }
}

async function bootstrap() {
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
    console.log('📁 uploads 目录已创建');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');

  await seedDefaults(app);

  await app.listen(3000);
  console.log('🎭 实验戏剧排练档案系统后端已启动: http://localhost:3000');
}
bootstrap();
