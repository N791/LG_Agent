import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'prettier';
import './openapi-env';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  const document = createOpenApiDocument(app);
  const output = process.env['OPENAPI_OUTPUT']
    ? path.resolve(process.env['OPENAPI_OUTPUT'])
    : path.resolve(process.cwd(), '../contracts/schemas/openapi.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, await format(JSON.stringify(document), { parser: 'json' }));
  await app.close();
  process.stdout.write(`Generated ${output}\n`);
}

void generate().catch((error: unknown) => {
  process.stderr.write(
    `OpenAPI generation failed: ${
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    }\n`,
  );
  process.exitCode = 1;
});
