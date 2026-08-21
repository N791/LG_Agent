import { ConflictException } from '@nestjs/common';
import { SubmissionStatus } from '@lg-agent/contracts';

const TRANSITIONS: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = {
  [SubmissionStatus.PENDING]: [
    SubmissionStatus.RUNNING,
    SubmissionStatus.ERROR,
    SubmissionStatus.CANCELLED,
  ],
  [SubmissionStatus.RUNNING]: [
    SubmissionStatus.PASSED,
    SubmissionStatus.FAILED,
    SubmissionStatus.ERROR,
    SubmissionStatus.CANCELLED,
  ],
  [SubmissionStatus.PASSED]: [],
  [SubmissionStatus.FAILED]: [],
  [SubmissionStatus.ERROR]: [],
  [SubmissionStatus.CANCELLED]: [],
};

export const TERMINAL_SUBMISSION_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.PASSED,
  SubmissionStatus.FAILED,
  SubmissionStatus.ERROR,
  SubmissionStatus.CANCELLED,
]);

export class SubmissionStateMachine {
  static canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
    return TRANSITIONS[from].includes(to);
  }

  static assertTransition(from: SubmissionStatus, to: SubmissionStatus): void {
    if (!this.canTransition(from, to)) {
      throw new ConflictException({
        message: 'errors.submission.invalidTransition',
        args: { from, to },
      });
    }
  }
}
