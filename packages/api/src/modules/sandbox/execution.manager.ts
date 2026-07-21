import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChildProcess } from 'child_process';

@Injectable()
export class ExecutionManager {
  private readonly logger = new Logger(ExecutionManager.name);
  private readonly processes = new Map<string, ChildProcess>();

  register(executionId: string, childProcess: ChildProcess): void {
    this.processes.set(executionId, childProcess);
    this.logger.debug(`Execution ${executionId} registered.`);
  }

  unregister(executionId: string): void {
    this.processes.delete(executionId);
    this.logger.debug(`Execution ${executionId} unregistered.`);
  }

  stop(executionId: string): void {
    const process = this.processes.get(executionId);
    if (!process) {
      throw new NotFoundException({
        message: 'errors.sandbox.executionNotFound',
        args: { id: executionId },
      });
    }

    this.logger.log(`Stopping execution ${executionId}...`);
    // Attempt graceful kill first, then fallback to SIGKILL
    process.kill('SIGTERM');
    setTimeout(() => {
      if (this.processes.has(executionId) && !process.killed) {
        process.kill('SIGKILL');
      }
    }, 2000);
  }
}
