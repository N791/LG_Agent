import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { I18nValidationPipe, I18nValidationExceptionFilter } from 'nestjs-i18n';
import { TranslationExceptionFilter } from './common/filters/translation-exception.filter';
import { Logger } from 'nestjs-pino';
import * as fs from 'fs';
import * as path from 'path';
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

  const trainee = await prisma.user.findUnique({ where: { username: 'trainee' } });
  if (!trainee) {
    const hashedPassword = await bcrypt.hash('trainee123', 10);
    await prisma.user.create({
      data: {
        username: 'trainee',
        password: hashedPassword,
        role: 'TRAINEE',
        organizationId: org.id,
        nickname: 'Trainee User',
      },
    });
    console.log('Default trainee user created.');
  }

  const mentor = await prisma.user.findUnique({ where: { username: 'mentor' } });
  if (!mentor) {
    const hashedPassword = await bcrypt.hash('mentor123', 10);
    await prisma.user.create({
      data: {
        username: 'mentor',
        password: hashedPassword,
        role: 'MENTOR',
        organizationId: org.id,
        nickname: 'Mentor User',
      },
    });
    console.log('Default mentor user created.');
  }

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new I18nValidationExceptionFilter({
      detailedErrors: false,
    }),
    new TranslationExceptionFilter(),
  );

  const config = new DocumentBuilder()
    .setTitle('LG Agent API')
    .setDescription('The LG Agent API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  if (process.env['GENERATE_OPENAPI'] === 'true') {
    const contractsPath = path.resolve(__dirname, '../../../contracts/schemas');
    if (!fs.existsSync(contractsPath)) {
      fs.mkdirSync(contractsPath, { recursive: true });
    }
    fs.writeFileSync(path.join(contractsPath, 'openapi.json'), JSON.stringify(document, null, 2));
    console.log('OpenAPI specification generated at contracts/schemas/openapi.json');
    process.exit(0);
  }

  const port = process.env['PORT'] ?? process.env['APP_PORT'] ?? 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${String(port)}`);
}
void bootstrap();
