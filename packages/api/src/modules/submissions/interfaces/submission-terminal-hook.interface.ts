import { SubmissionStatus } from '@lg-agent/contracts';

export interface SubmissionTerminalContext {
  submissionId: string;
  userId: string;
  taskId: string;
  status:
    | SubmissionStatus.PASSED
    | SubmissionStatus.FAILED
    | SubmissionStatus.ERROR
    | SubmissionStatus.CANCELLED;
  score: number;
  logs: string;
}

export interface ISubmissionTerminalHook {
  afterTerminal(context: SubmissionTerminalContext): Promise<void>;
}

export const SUBMISSION_TERMINAL_HOOKS = Symbol('ISubmissionTerminalHook[]');
