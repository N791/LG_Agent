/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/require-await */
import { ExecutionEventType, SubmissionStatus } from '@lg-agent/contracts';
import { lastValueFrom, toArray } from 'rxjs';
import type { SubmissionTerminalContext } from './interfaces/submission-terminal-hook.interface';
import { InMemoryExecutionEventBus } from './services/in-memory-execution-event-bus';
import { SubmissionsService } from './submissions.service';

describe('Workspace -> Submit -> SSE -> Result -> AI Review', () => {
  it('replays only events after the SSE reconnect cursor', async () => {
    const eventBus = new InMemoryExecutionEventBus();
    await eventBus.publish('submission-reconnect', {
      type: ExecutionEventType.RUNNING,
      timestamp: new Date().toISOString(),
    });
    await eventBus.publish('submission-reconnect', {
      type: ExecutionEventType.LOG,
      data: { text: 'after reconnect' },
      timestamp: new Date().toISOString(),
    });
    await eventBus.complete('submission-reconnect');

    const events = await lastValueFrom(
      eventBus.subscribe('submission-reconnect', 1).pipe(toArray()),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sequence: 2,
      type: ExecutionEventType.LOG,
    });
  });

  it('owns the complete failed-submission lifecycle', async () => {
    const record: {
      id: string;
      userId: string;
      taskId: string;
      status: string;
      score: number;
      logs?: string;
      report?: Record<string, unknown> | null;
    } = {
      id: 'submission-1',
      userId: 'user-1',
      taskId: 'task-1',
      status: SubmissionStatus.PENDING,
      score: 0,
    };
    const prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue({ id: 'task-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'task-1',
          testConfig: { script: 'npm test' },
          envConfig: null,
          course: { organizationId: 'org-1' },
        }),
      },
      submission: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async () => ({ ...record })),
        findUnique: jest.fn().mockImplementation(async () => ({ ...record })),
        updateMany: jest.fn().mockImplementation(
          async (args: {
            where: { id: string; status: string };
            data: {
              status: string;
              score?: number;
              logs?: string;
              report?: Record<string, unknown> | null;
            };
          }) => {
            if (args.where.id !== record.id || args.where.status !== record.status) {
              return { count: 0 };
            }
            Object.assign(record, args.data);
            return { count: 1 };
          },
        ),
      },
    };
    const workspace = {
      getWorkspace: jest.fn().mockResolvedValue({
        taskId: 'task-1',
        workspace: { files: [{ path: 'index.ts', content: 'broken()' }] },
      }),
      createVersion: jest.fn().mockResolvedValue({ id: 'version-1' }),
    };
    const sandbox = {
      runTask: async function* () {
        yield {
          type: ExecutionEventType.RUNNING,
          timestamp: new Date().toISOString(),
        };
        yield {
          type: ExecutionEventType.LOG,
          data: { text: 'test failed' },
          timestamp: new Date().toISOString(),
        };
        yield {
          type: ExecutionEventType.FAILED,
          data: { passed: false, score: 30, report: { failed: 1 } },
          timestamp: new Date().toISOString(),
        };
        yield {
          type: ExecutionEventType.COMPLETE,
          timestamp: new Date().toISOString(),
        };
      },
    };
    const eventBus = new InMemoryExecutionEventBus();
    const executionAdapter = {
      dispatch: jest.fn().mockImplementation(async (job: { execute: () => Promise<void> }) => {
        setImmediate(() => void job.execute());
      }),
    };
    let reviewed: SubmissionTerminalContext | undefined;
    const aiReviewHook = {
      afterTerminal: jest.fn().mockImplementation(async (context: SubmissionTerminalContext) => {
        reviewed = context;
      }),
    };
    const service = new SubmissionsService(
      prisma as any,
      sandbox as any,
      workspace as any,
      eventBus,
      executionAdapter as any,
      [aiReviewHook],
    );

    const accepted = await service.submitTask(
      { id: 'user-1', organizationId: 'org-1', role: 'TRAINEE' },
      'task-1',
    );
    for (let attempt = 0; attempt < 20 && record.status !== SubmissionStatus.FAILED; attempt += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const events = await lastValueFrom(eventBus.subscribe(accepted.submissionId).pipe(toArray()));

    expect(workspace.createVersion).toHaveBeenCalledWith('task-1', 'user-1', 'SUBMIT');
    expect(accepted).toEqual({ submissionId: 'submission-1', duplicate: false });
    expect(events.map((event) => event.type)).toEqual([
      ExecutionEventType.RUNNING,
      ExecutionEventType.LOG,
      ExecutionEventType.FAILED,
      ExecutionEventType.COMPLETE,
    ]);
    expect(record).toMatchObject({
      status: SubmissionStatus.FAILED,
      score: 30,
      logs: 'test failed',
      report: { failed: 1 },
    });
    expect(reviewed).toMatchObject({
      submissionId: 'submission-1',
      status: SubmissionStatus.FAILED,
    });
  });
});
