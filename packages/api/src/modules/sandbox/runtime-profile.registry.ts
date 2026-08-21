import { Injectable } from '@nestjs/common';
import {
  SandboxRuntimeErrorCode,
  type RuntimeCommandDTO,
  type RuntimeEnvironmentDTO,
  type SandboxAction,
} from '@lg-agent/contracts';
import { SandboxSecurityConfig } from './sandbox-security.config';
import type { IRuntimeProfile, ResolvedRuntime } from './interfaces/runtime-profile.interface';
import { NodeRuntimeProfile } from './node-runtime.profile';
import {
  GoRuntimeProfile,
  JavaRuntimeProfile,
  PythonRuntimeProfile,
  RustRuntimeProfile,
} from './language-runtime.profiles';

export class SandboxRuntimeError extends Error {
  constructor(
    readonly code: SandboxRuntimeErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

@Injectable()
export class RuntimeProfileRegistry {
  private readonly profiles = new Map<string, IRuntimeProfile>();

  constructor(
    private readonly security: SandboxSecurityConfig,
    node: NodeRuntimeProfile,
    java: JavaRuntimeProfile,
    python: PythonRuntimeProfile,
    go: GoRuntimeProfile,
    rust: RustRuntimeProfile,
  ) {
    [node, java, python, go, rust].forEach((profile) => {
      this.profiles.set(profile.language, profile);
      this.profiles.set(`${profile.language}:${profile.runtime}`, profile);
    });
  }

  resolve(
    requested: Partial<RuntimeEnvironmentDTO> | null | undefined,
    action: SandboxAction,
    fallbackEntry?: string,
  ): ResolvedRuntime {
    const language = requested?.language ?? 'node';
    if (!this.security.isLanguageEnabled(language)) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.LANGUAGE_DISABLED,
        `Runtime language "${language}" is disabled.`,
      );
    }
    const profile = this.profiles.get(
      requested?.runtime ? `${language}:${requested.runtime}` : language,
    );
    if (!profile) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.UNSUPPORTED_RUNTIME,
        `No profile is registered for ${language}/${requested?.runtime ?? language}.`,
      );
    }
    const version = requested?.version ?? profile.defaultVersion;
    if (!profile.versions.includes(version)) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.VERSION_MISMATCH,
        `${profile.runtime} ${version} is unsupported; expected ${profile.versions.join(', ')}.`,
      );
    }
    const entry = requested?.entry ?? fallbackEntry ?? profile.defaultEntry;
    const requirement = requested?.actionRequirements?.[action];
    if (requirement === 'unsupported') {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.ACTION_UNSUPPORTED,
        `Action "${action}" is unsupported by this task.`,
      );
    }
    const override = requested?.actions?.[action];
    const command = override ?? profile.command(action, entry);
    this.assertCommand(command, profile);
    const image = this.security.imageFor(profile.language, version);
    return {
      profile,
      environment: {
        language: profile.language,
        runtime: profile.runtime,
        version,
        entry,
        actions: requested?.actions,
        actionRequirements: requested?.actionRequirements,
      },
      command,
      image,
    };
  }

  private assertCommand(command: RuntimeCommandDTO, profile: IRuntimeProfile): void {
    if (!command.executable || !Array.isArray(command.args)) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.COMMAND_MISSING,
        'A structured executable and args array are required.',
      );
    }
    if (!profile.allowedExecutables.includes(command.executable)) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.COMMAND_MISSING,
        `Executable "${command.executable}" is not allowed by the ${profile.language} profile.`,
      );
    }
    if (command.workdir?.startsWith('/') || command.workdir?.includes('..')) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.COMMAND_MISSING,
        'Runtime workdir must remain inside the execution workspace.',
      );
    }
  }
}
