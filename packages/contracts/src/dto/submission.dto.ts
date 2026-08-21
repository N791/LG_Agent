export enum SubmissionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
}

export class RunSubmissionRequestDTO {
  taskId!: string;
  idempotencyKey?: string;
}

export interface RunSubmissionResponseDTO {
  submissionId: string;
  duplicate: boolean;
}

export interface SubmissionDTO {
  id: string;
  taskId: string;
  userId: string;
  status: SubmissionStatus;
  score: number;
  logs?: string | null;
  report?: Record<string, unknown> | null;
  aiReview?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  attempt: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

export interface ExecutionEventRecordDTO {
  id: string;
  submissionId: string;
  sequence: number;
  event: import('./workspace.dto').ExecutionEventDTO;
  createdAt: string;
}
