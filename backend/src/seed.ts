import { DataSource } from 'typeorm';
import { User, UserRole } from './entities';
import { join } from 'path';

async function seed() {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: join(process.cwd(), 'theater.db'),
    entities: [User],
    synchronize: true,
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  const admin = await userRepo.findOne({ where: { username: 'admin' } });
  if (!admin) {
    await userRepo.save(
      userRepo.create({
        username: 'admin',
        password: 'admin',
        role: UserRole.ADMIN,
        displayName: '系统管理员',
      }),
    );
    console.log('✅ 默认管理员用户已创建: admin / admin');
  } else {
    console.log('管理员用户已存在，跳过');
  }

  const director = await userRepo.findOne({ where: { username: 'director' } });
  if (!director) {
    await userRepo.save(
      userRepo.create({
        username: 'director',
        password: 'director',
        role: UserRole.DIRECTOR,
        displayName: '张导',
      }),
    );
    console.log('✅ 默认导演用户已创建: director / director');
  }

  const actor = await userRepo.findOne({ where: { username: 'actor' } });
  if (!actor) {
    await userRepo.save(
      userRepo.create({
        username: 'actor',
        password: 'actor',
        role: UserRole.ACTOR,
        displayName: '演员小李',
      }),
    );
    console.log('✅ 默认演员用户已创建: actor / actor');
  }

  await dataSource.destroy();
}

seed().catch(console.error);
