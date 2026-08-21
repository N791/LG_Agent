const weakJwtSecrets = new Set([
  'secretKey',
  'default-secret',
  'super-secret-key',
  'change-me-in-production',
]);

function requiredNames(): string[] {
  return (process.env['REQUIRED_DEPLOYMENT_ENV'] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required deployment environment variable ${name} is missing`);
  return value;
}

function requireUrl(name: string, protocols: readonly string[]): void {
  const parsed = new URL(requireValue(name));
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use one of: ${protocols.join(', ')}`);
  }
}

export function validateDeploymentEnvironment(): void {
  const names = requiredNames();
  if (names.length === 0) {
    throw new Error('REQUIRED_DEPLOYMENT_ENV must declare the production secret contract');
  }
  names.forEach(requireValue);

  requireUrl('DATABASE_URL', ['postgresql:', 'postgres:']);
  requireUrl('REDIS_URL', ['redis:', 'rediss:']);

  const jwtSecret = requireValue('JWT_SECRET');
  if (jwtSecret.length < 32 || weakJwtSecrets.has(jwtSecret)) {
    throw new Error('JWT_SECRET must be at least 32 characters and must not use a known default');
  }

  const provider = requireValue('LLM_PROVIDER');
  if (provider === 'openai') requireValue('OPENAI_API_KEY');
  if (provider === 'deepseek') requireValue('DEEPSEEK_API_KEY');
  if (process.env['NODE_ENV'] === 'production' && provider === 'mock') {
    throw new Error('The mock LLM provider is forbidden in production');
  }

  const sandboxExecutor = requireValue('SANDBOX_EXECUTOR');
  if (process.env['NODE_ENV'] === 'production' && sandboxExecutor !== 'docker') {
    throw new Error('Production SANDBOX_EXECUTOR must be docker');
  }

  process.stdout.write(`Validated ${String(names.length)} production configuration values.\n`);
}

if (require.main === module) {
  try {
    validateDeploymentEnvironment();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
