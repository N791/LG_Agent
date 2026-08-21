import { ConflictException } from '@nestjs/common';
import { SubmissionStatus } from '@lg-agent/contracts';
import { SubmissionStateMachine } from './submission-state-machine';

describe('SubmissionStateMachine contract', () => {
  it.each([
    [SubmissionStatus.PENDING, SubmissionStatus.RUNNING],
    [SubmissionStatus.RUNNING, SubmissionStatus.PASSED],
    [SubmissionStatus.RUNNING, SubmissionStatus.FAILED],
    [SubmissionStatus.RUNNING, SubmissionStatus.ERROR],
    [SubmissionStatus.PENDING, SubmissionStatus.ERROR],
  ])('allows %s -> %s', (from, to) => {
    expect(SubmissionStateMachine.canTransition(from, to)).toBe(true);
    expect(() => {
      SubmissionStateMachine.assertTransition(from, to);
    }).not.toThrow();
  });

  it.each([SubmissionStatus.PASSED, SubmissionStatus.FAILED, SubmissionStatus.ERROR])(
    'keeps terminal status %s irreversible',
    (status) => {
      for (const target of Object.values(SubmissionStatus)) {
        expect(SubmissionStateMachine.canTransition(status, target)).toBe(false);
        expect(() => {
          SubmissionStateMachine.assertTransition(status, target);
        }).toThrow(ConflictException);
      }
    },
  );

  it.each([
    [SubmissionStatus.PENDING, SubmissionStatus.PASSED],
    [SubmissionStatus.PENDING, SubmissionStatus.FAILED],
    [SubmissionStatus.RUNNING, SubmissionStatus.PENDING],
    [SubmissionStatus.RUNNING, SubmissionStatus.RUNNING],
  ])('rejects illegal transition %s -> %s', (from, to) => {
    expect(() => {
      SubmissionStateMachine.assertTransition(from, to);
    }).toThrow(ConflictException);
  });
});
