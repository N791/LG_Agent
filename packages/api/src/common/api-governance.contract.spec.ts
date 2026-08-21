import * as fs from 'fs';
import * as path from 'path';

interface Operation {
  requestBody?: {
    content?: { 'application/json'?: { schema?: { $ref?: string } } };
  };
  responses: Record<string, { content?: Record<string, { schema?: unknown }> }>;
}

interface OpenApiContract {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
}

describe('Epic 71 API governance contract', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), '../contracts/schemas/openapi.json'), 'utf8'),
  ) as OpenApiContract;

  const requestSchema = (method: string, route: string): string | undefined =>
    contract.paths[route]?.[method]?.requestBody?.content?.['application/json']?.schema?.$ref;

  it.each([
    ['post', '/api/v1/auth/login', 'LoginRequestDTO'],
    ['post', '/api/v1/auth/refresh', 'RefreshTokenRequestDTO'],
    ['post', '/api/v1/workspaces/init', 'InitWorkspaceRequestDTO'],
    ['put', '/api/v1/workspaces/{taskId}/files', 'UpdateWorkspaceFilesRequestDTO'],
    ['post', '/api/v1/submissions/run', 'RunSubmissionRequestDTO'],
    ['post', '/api/v1/ai/tutor/chat', 'ChatRequestDTO'],
    ['post', '/api/v1/sandbox/execute', 'ExecuteSandboxDTO'],
  ])('%s %s uses shared %s', (method, route, dto) => {
    expect(requestSchema(method, route)).toBe(`#/components/schemas/${dto}`);
  });

  it('publishes uniform JSON envelopes', () => {
    const operation = contract.paths['/api/v1/workspaces/{taskId}']?.['get'];
    expect(operation?.responses['200']?.content?.['application/json']).toBeDefined();
    expect(operation?.responses['400']?.content?.['application/json']).toBeDefined();
    expect(contract.components.schemas['ApiSuccessEnvelope']).toBeDefined();
    expect(contract.components.schemas['ApiErrorEnvelope']).toBeDefined();
  });

  it.each([
    ['get', '/api/v1/submissions/{id}/logs'],
    ['get', '/api/v1/sandbox/executions/{executionId}/logs'],
    ['post', '/api/v1/ai/tutor/chat'],
  ])('%s %s documents versioned SSE outside the JSON envelope', (method, route) => {
    const response = contract.paths[route]?.[method]?.responses['200'];
    expect(response?.content?.['text/event-stream']).toBeDefined();
  });

  it('does not expose placeholder or legacy endpoints', () => {
    expect(contract.paths['/api/v1/auth/ldap']).toBeUndefined();
    expect(contract.paths['/api/v1/auth/sso']).toBeUndefined();
    expect(contract.paths['/api/v1/training/submit']).toBeUndefined();
  });
});
