import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  await app.listen(3000);
  console.log('🎭 实验戏剧排练档案系统后端已启动: http://localhost:3000');
}
bootstrap();
