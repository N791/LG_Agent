import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { I18nValidationPipe } from 'nestjs-i18n';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors();
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['PORT'] ?? process.env['APP_PORT'] ?? 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${String(port)}`);
}
void bootstrap();
