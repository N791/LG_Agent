export type SandboxAction = 'run' | 'build' | 'lint' | 'test';

export interface ExecuteSandboxDTO {
  taskId: string;
  action: SandboxAction;
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
  // Future extensibility for enterprise hardware metrics
  hardware?: {
    cpuPercent?: number;
    memoryBytes?: number;
    ioReadBytes?: number;
    ioWriteBytes?: number;
  };
}
