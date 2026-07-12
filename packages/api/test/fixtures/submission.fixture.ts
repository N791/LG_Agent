import { Submission } from '@prisma/client';

export const SubmissionFixture = {
  createPassed: (overrides?: Partial<Submission>): Submission => ({
    id: 'submission-1',
    taskId: 'task-1',
    userId: 'user-trainee-1',
    status: 'PASSED',
    score: 95,
    report: { aiReview: 'Great job!' },
    logs: null,
    createdAt: new Date(),
    ...overrides,
  }),
  createFailed: (overrides?: Partial<Submission>): Submission => ({
    id: 'submission-2',
    taskId: 'task-1',
    userId: 'user-trainee-1',
    status: 'FAILED',
    score: 40,
    report: { aiReview: 'Needs improvement' },
    logs: null,
    createdAt: new Date(),
    ...overrides,
  }),
};
