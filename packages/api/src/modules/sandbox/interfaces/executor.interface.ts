export interface ExecutionResult {
  passed: boolean;
  score: number;
  logs: string;
  report: Record<string, unknown>; // EvaluationReport will be injected or returned here
}

export interface IExecutor {
  execute(
    taskId: string,
    userId: string,
    code: string,
    config: { testScript?: string; env?: Record<string, unknown> },
  ): Promise<ExecutionResult>;
}
