import { ConfigService } from '@nestjs/config';
import { SandboxSecurityConfig } from './sandbox-security.config';

const digest = (image: string, character: string) => `${image}@sha256:${character.repeat(64)}`;

function createConfig(overrides: Record<string, string> = {}) {
  return new ConfigService({
    SANDBOX_NODE_IMAGE: digest('node:20-alpine', 'a'),
    SANDBOX_JAVA_IMAGE: digest('eclipse-temurin:21-jdk', 'b'),
    SANDBOX_PYTHON_IMAGE: digest('python:3.12-slim', 'c'),
    SANDBOX_GO_IMAGE: digest('golang:1.24-alpine', 'd'),
    SANDBOX_RUST_IMAGE: digest('rust:1.84-slim', 'e'),
    SANDBOX_IMAGE_ALLOWLIST: 'node:20-alpine',
    SANDBOX_ENABLED_LANGUAGES: 'node',
    SANDBOX_MEMORY_LIMIT: '256m',
    SANDBOX_CPU_LIMIT: 0.5,
    SANDBOX_PIDS_LIMIT: 128,
    SANDBOX_TIMEOUT_MS: 30_000,
    SANDBOX_USER_CONCURRENCY: 2,
    SANDBOX_ORG_CONCURRENCY: 10,
    ...overrides,
  });
}

describe('SandboxSecurityConfig', () => {
  it('validates only images for enabled languages', () => {
    const security = new SandboxSecurityConfig(createConfig());

    expect(security.isLanguageEnabled('node')).toBe(true);
    expect(security.imageFor('node', '20')).toContain('node:20-alpine@sha256:');
  });

  it('rejects an enabled language whose image is not allowlisted', () => {
    expect(
      () => new SandboxSecurityConfig(createConfig({ SANDBOX_ENABLED_LANGUAGES: 'node,java' })),
    ).toThrow('eclipse-temurin:21-jdk');
  });

  it('rejects an enabled language without a configured runtime', () => {
    expect(
      () => new SandboxSecurityConfig(createConfig({ SANDBOX_ENABLED_LANGUAGES: 'node,ruby' })),
    ).toThrow('No Sandbox image is configured for enabled language "ruby".');
  });
});
