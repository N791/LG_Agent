import { validateDeploymentEnvironment } from './validate-deployment-env';

const names = [
  'REQUIRED_DEPLOYMENT_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_URL',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'OPENAI_API_KEY',
  'SANDBOX_IMAGE_PULL_SECRET',
  'LLM_PROVIDER',
  'SANDBOX_EXECUTOR',
  'NODE_ENV',
] as const;

describe('Epic 82 deployment environment gate', () => {
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    Object.assign(process.env, {
      REQUIRED_DEPLOYMENT_ENV:
        'DATABASE_URL,JWT_SECRET,REDIS_URL,MINIO_ENDPOINT,MINIO_ACCESS_KEY,MINIO_SECRET_KEY,OPENAI_API_KEY,SANDBOX_IMAGE_PULL_SECRET',
      DATABASE_URL: 'postgresql://user:password@postgres:5432/lg_agent',
      JWT_SECRET: 'a-production-secret-that-is-longer-than-32-characters',
      REDIS_URL: 'rediss://redis:6379',
      MINIO_ENDPOINT: 'minio.example.com',
      MINIO_ACCESS_KEY: 'access',
      MINIO_SECRET_KEY: 'secret',
      OPENAI_API_KEY: 'provider-key',
      SANDBOX_IMAGE_PULL_SECRET: 'runtime-registry',
      LLM_PROVIDER: 'openai',
      SANDBOX_EXECUTOR: 'docker',
      NODE_ENV: 'production',
    });
  });

  afterAll(() => {
    for (const name of names) {
      const value = original[name];
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = value;
    }
  });

  it('accepts a complete production contract', () => {
    expect(() => {
      validateDeploymentEnvironment();
    }).not.toThrow();
  });

  it('rejects missing external Secret keys before migration', () => {
    delete process.env['MINIO_SECRET_KEY'];
    expect(() => {
      validateDeploymentEnvironment();
    }).toThrow('Required deployment environment variable MINIO_SECRET_KEY is missing');
  });

  it('rejects weak JWT and local sandbox production settings', () => {
    process.env['JWT_SECRET'] = 'change-me-in-production';
    expect(() => {
      validateDeploymentEnvironment();
    }).toThrow('JWT_SECRET must be at least 32');

    process.env['JWT_SECRET'] = 'a-production-secret-that-is-longer-than-32-characters';
    process.env['SANDBOX_EXECUTOR'] = 'local';
    expect(() => {
      validateDeploymentEnvironment();
    }).toThrow('Production SANDBOX_EXECUTOR must be docker');
  });
});
