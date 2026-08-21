import {
  SandboxRuntimeErrorCode,
  type RuntimeCommandDTO,
  type SandboxAction,
} from '@lg-agent/contracts';
import { IRuntimeProfile } from './interfaces/runtime-profile.interface';

export class NodeRuntimeProfile implements IRuntimeProfile {
  readonly language = 'node' as const;
  readonly runtime = 'node';
  readonly versions = ['20'] as const;
  readonly allowedExecutables = ['node', 'npm', 'npx'] as const;
  readonly defaultVersion = '20';
  readonly defaultEntry = 'index.js';

  command(action: SandboxAction, entryPoint: string): RuntimeCommandDTO {
    if (action === 'run') {
      if (/\.(?:ts|mts|cts)$/.test(entryPoint)) {
        throw new Error(
          `${SandboxRuntimeErrorCode.TYPESCRIPT_RUNNER_UNAVAILABLE}: Node 20 cannot execute TypeScript without a pinned task runner.`,
        );
      }
      return {
        executable: 'node',
        args: [entryPoint],
      };
    }
    return { executable: 'npm', args: ['run', action] };
  }
}
