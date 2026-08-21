import { EventEmitter } from 'events';
import { ExecutionManager } from './execution.manager';
import { Role } from '@prisma/client';

describe('ExecutionManager cancellation', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends SIGTERM, then force-kills an execution that remains registered', () => {
    jest.useFakeTimers();
    const manager = new ExecutionManager();
    const child = new EventEmitter() as EventEmitter & {
      kill: jest.Mock;
      killed: boolean;
    };
    child.killed = false;
    child.kill = jest.fn(() => {
      child.killed = true;
      return true;
    });
    manager.register('execution-1', child as never);

    manager.stop('execution-1', {
      id: 'internal',
      organizationId: 'internal',
      role: Role.TRAINEE,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    jest.advanceTimersByTime(2000);
    expect(child.kill).toHaveBeenLastCalledWith('SIGKILL');
  });
});
