import { SandboxRuntimeErrorCode, type SandboxAction } from '@lg-agent/contracts';
import {
  GoRuntimeProfile,
  JavaRuntimeProfile,
  PythonRuntimeProfile,
  RustRuntimeProfile,
} from './language-runtime.profiles';
import { NodeRuntimeProfile } from './node-runtime.profile';
import { RuntimeProfileRegistry, SandboxRuntimeError } from './runtime-profile.registry';
import type { SandboxSecurityConfig } from './sandbox-security.config';

describe('Epic B runtime profile contract', () => {
  const profiles = [
    new NodeRuntimeProfile(),
    new JavaRuntimeProfile(),
    new PythonRuntimeProfile(),
    new GoRuntimeProfile(),
    new RustRuntimeProfile(),
  ];
  const security = {
    isLanguageEnabled: () => true,
    imageFor: (language: string, version: string) =>
      `${language}:${version}@sha256:${'a'.repeat(64)}`,
  } as unknown as SandboxSecurityConfig;
  const registry = new RuntimeProfileRegistry(
    security,
    profiles[0] as NodeRuntimeProfile,
    profiles[1] as JavaRuntimeProfile,
    profiles[2] as PythonRuntimeProfile,
    profiles[3] as GoRuntimeProfile,
    profiles[4] as RustRuntimeProfile,
  );

  it.each(profiles)('$language uses structured commands for every action', (profile) => {
    for (const action of ['build', 'lint', 'test', 'run'] as SandboxAction[]) {
      const resolved = registry.resolve(
        {
          language: profile.language,
          runtime: profile.runtime,
          version: profile.defaultVersion,
          entry: profile.defaultEntry,
        },
        action,
      );
      expect(resolved.command.executable).toMatch(/^[A-Za-z0-9._+-]+$/);
      expect(Array.isArray(resolved.command.args)).toBe(true);
      expect(resolved.image).toContain('@sha256:');
    }
  });

  it('keeps malicious-looking user arguments as one spawn argument', () => {
    const entry = 'main.py; touch escaped';
    const command = registry.resolve({ language: 'python', version: '3.12', entry }, 'run').command;
    expect(command).toEqual({ executable: 'python', args: [entry] });
  });

  it('rejects shell executables supplied through task actions', () => {
    expect(() =>
      registry.resolve(
        {
          language: 'python',
          version: '3.12',
          entry: 'main.py',
          actions: { run: { executable: 'sh', args: ['-c', 'touch escaped'] } },
        },
        'run',
      ),
    ).toThrow(SandboxRuntimeErrorCode.COMMAND_MISSING);
  });

  it('returns a stable code for unsupported versions', () => {
    try {
      registry.resolve({ language: 'go', version: '0.1', entry: '.' }, 'test');
      throw new Error('Expected runtime resolution to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SandboxRuntimeError);
      expect((error as SandboxRuntimeError).code).toBe(SandboxRuntimeErrorCode.VERSION_MISMATCH);
    }
  });
});
