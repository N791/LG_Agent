import type {
  RuntimeCommandDTO,
  RuntimeEnvironmentDTO,
  RuntimeLanguage,
  SandboxAction,
} from '@lg-agent/contracts';

export interface IRuntimeProfile {
  readonly language: RuntimeLanguage;
  readonly runtime: string;
  readonly versions: readonly string[];
  readonly allowedExecutables: readonly string[];
  readonly defaultVersion: string;
  readonly defaultEntry: string;
  command(action: SandboxAction, entryPoint: string): RuntimeCommandDTO;
}

export interface ResolvedRuntime {
  profile: IRuntimeProfile;
  environment: RuntimeEnvironmentDTO;
  command: RuntimeCommandDTO;
  image: string;
}
