export interface ExecutionLease {
  ownerId: string;
  attempt: number;
}

export interface ExecutionJob {
  submissionId: string;
  execute: (lease?: ExecutionLease) => Promise<void>;
  onDeadLetter: (reason: string) => Promise<void>;
  onCancelled: () => Promise<void>;
}

export interface IExecutionAdapter {
  dispatch(job: ExecutionJob): Promise<void>;
  cancel(submissionId: string): Promise<void>;
  replay(submissionId: string, job: ExecutionJob): Promise<void>;
}

export const EXECUTION_ADAPTER = Symbol('IExecutionAdapter');
