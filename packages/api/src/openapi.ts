import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

const SSE_PATHS = new Set([
  '/api/v1/submissions/{id}/logs',
  '/api/v1/sandbox/executions/{executionId}/logs',
  '/api/v1/ai/tutor/chat',
]);

interface MutableResponse {
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('LG Agent API')
    .setDescription('Generated API contract. Do not hand-edit payload schemas.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas['ApiErrorEnvelope'] = {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'integer', format: 'int32' },
      message: { type: 'string' },
      details: {},
      traceId: { type: 'string' },
    },
  };
  document.components.schemas['ApiSuccessEnvelope'] = {
    type: 'object',
    required: ['code', 'message', 'data'],
    properties: {
      code: { type: 'integer', format: 'int32' },
      message: { type: 'string', example: 'success' },
      data: {},
    },
  };

  for (const [route, pathItem] of Object.entries(document.paths)) {
    for (const candidate of Object.values(pathItem)) {
      if (!candidate || typeof candidate !== 'object' || !('responses' in candidate)) continue;
      const operation = candidate as { responses: Record<string, unknown> };
      const responses = operation.responses;
      for (const [status, response] of Object.entries(responses)) {
        if (
          !status.startsWith('2') ||
          status === '204' ||
          !response ||
          typeof response !== 'object' ||
          '$ref' in response
        ) {
          continue;
        }
        const responseObject = response as MutableResponse;
        if (SSE_PATHS.has(route)) {
          responseObject.content = {
            ...(responseObject.content ?? {}),
            'text/event-stream': {
              schema: { $ref: '#/components/schemas/VersionedSseEvent' },
            },
          };
        } else {
          const dataSchema = responseObject.content?.['application/json']?.schema ?? {};
          responseObject.content = {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiSuccessEnvelope' },
                  {
                    type: 'object',
                    properties: { data: dataSchema },
                  },
                ],
              },
            },
          };
        }
      }
      for (const status of ['400', '401', '403', '404', '500']) {
        responses[status] ??= {
          description: `HTTP ${status}`,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiErrorEnvelope' },
            },
          },
        };
      }
    }
  }

  document.components.schemas['VersionedSseEvent'] = {
    type: 'object',
    required: ['version', 'type', 'timestamp'],
    properties: {
      version: { type: 'string', enum: ['1.0'] },
      type: { type: 'string' },
      data: {},
      message: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  };
  return document;
}
