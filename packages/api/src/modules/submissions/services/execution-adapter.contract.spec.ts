import type { ExecutionJob } from '../interfaces/execution-adapter.interface';
import { DatabaseExecutionAdapter } from './database-execution.adapter';
import { InProcessExecutionAdapter } from './in-process-execution.adapter';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

describe.each([
  {
    name: 'in-process',
    create: () =>
      new InProcessExecutionAdapter({
        stop: jest.fn(),
      } as never),
  },
  {
    name: 'database',
    create: () => {
      const state = {
        executionOwner: null as string | null,
        nextAttemptAt: new Date(),
        cancelRequestedAt: null as Date | null,
      };
      const prisma = {
        submission: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ attempt: 1 }),
          update: jest.fn().mockImplementation(({ data }: { data: typeof state }) => {
            Object.assign(state, data);
            return Promise.resolve({ ...state });
          }),
          updateMany: jest
            .fn()
            .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
              if (state.executionOwner !== null) return Promise.resolve({ count: 0 });
              if (typeof data['executionOwner'] === 'string') {
                state.executionOwner = data['executionOwner'];
              }
              return Promise.resolve({ count: 1 });
            }),
        },
      };
      return new DatabaseExecutionAdapter(prisma as never, { stop: jest.fn() } as never);
    },
  },
])('$name execution adapter contract', ({ create }) => {
  it('does not execute a duplicate delivery twice', async () => {
    const adapter = create();
    const job: ExecutionJob = {
      submissionId: 'submission-1',
      execute: jest.fn().mockResolvedValue(undefined),
      onDeadLetter: jest.fn().mockResolvedValue(undefined),
      onCancelled: jest.fn().mockResolvedValue(undefined),
    };

    await Promise.all([adapter.dispatch(job), adapter.dispatch(job)]);
    await flush();

    expect(job.execute).toHaveBeenCalledTimes(1);
    expect(job.onDeadLetter).not.toHaveBeenCalled();
  });
});

describe('execution retry policy', () => {
  it('dead-letters after the configured exponential-backoff retry limit', async () => {
    jest.useFakeTimers();
    try {
      const adapter = new InProcessExecutionAdapter({ stop: jest.fn() } as never);
      const job: ExecutionJob = {
        submissionId: 'submission-poison',
        execute: jest.fn().mockRejectedValue(new Error('poison message')),
        onDeadLetter: jest.fn().mockResolvedValue(undefined),
        onCancelled: jest.fn().mockResolvedValue(undefined),
      };

      await adapter.dispatch(job);
      await jest.runAllTimersAsync();

      expect(job.execute).toHaveBeenCalledTimes(4);
      expect(job.onDeadLetter).toHaveBeenCalledWith('poison message');
    } finally {
      jest.useRealTimers();
    }
  });
});
