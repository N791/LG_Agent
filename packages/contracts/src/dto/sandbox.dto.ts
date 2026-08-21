export type SandboxAction = 'run' | 'build' | 'lint' | 'test';
export type RuntimeLanguage = 'node' | 'java' | 'python' | 'go' | 'rust';

export interface RuntimeCommandDTO {
  executable: string;
  args: string[];
  env?: Record<string, string>;
  workdir?: string;
}

export interface RuntimeEnvironmentDTO {
  language: RuntimeLanguage;
  runtime?: string;
  version: string;
  entry: string;
  actions?: Partial<Record<SandboxAction, RuntimeCommandDTO>>;
  actionRequirements?: Partial<
    Record<SandboxAction, import('./starter-template.dto').TaskActionRequirement>
  >;
}

export enum SandboxRuntimeErrorCode {
  UNSUPPORTED_RUNTIME = 'SANDBOX_UNSUPPORTED_RUNTIME',
  VERSION_MISMATCH = 'SANDBOX_RUNTIME_VERSION_MISMATCH',
  IMAGE_MISSING = 'SANDBOX_RUNTIME_IMAGE_MISSING',
  COMMAND_MISSING = 'SANDBOX_RUNTIME_COMMAND_MISSING',
  LANGUAGE_DISABLED = 'SANDBOX_RUNTIME_LANGUAGE_DISABLED',
  ENTRY_MISSING = 'SANDBOX_ENTRY_MISSING',
  MANIFEST_MISSING = 'SANDBOX_MANIFEST_MISSING',
  SCRIPT_MISSING = 'SANDBOX_SCRIPT_MISSING',
  ACTION_UNSUPPORTED = 'SANDBOX_ACTION_UNSUPPORTED',
  TYPESCRIPT_RUNNER_UNAVAILABLE = 'SANDBOX_TYPESCRIPT_RUNNER_UNAVAILABLE',
}

export class ExecuteSandboxDTO {
  taskId!: string;
  action!: SandboxAction;
}

export interface ExecutionResponseDTO {
  executionId: string;
}

export interface ExecutionMetricsDTO {
  executionId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR' | 'STOPPED';
  startTime: number | null;
  endTime: number | null;
  durationMs: number;
  stageDurations: {
    initMs?: number;
    runMs?: number;
    cleanupMs?: number;
  };
  exitCode: number | null;
  retryCount: number;
  logCount: number;
  hardware?: {
    cpuPercent?: number;
    memoryBytes?: number;
    ioReadBytes?: number;
    ioWriteBytes?: number;
  };
}
