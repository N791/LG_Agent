import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma.service';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors();
  app.setGlobalPrefix('api/v1');

  // Seed default admin and organization
  const prisma = app.get(PrismaService);
  let org = await prisma.organization.findUnique({ where: { code: 'DEFAULT_ORG' } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Default Organization', code: 'DEFAULT_ORG' },
    });
    console.log('Default organization created.');
  }

  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        organizationId: org.id,
        nickname: 'Super Admin',
      },
    });
    console.log('Default admin user created.');
  }

  const port = process.env['APP_PORT'] ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${String(port)}`);
}
void bootstrap();
