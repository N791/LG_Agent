import { Injectable } from '@nestjs/common';
import { IExecutionEventBus } from '../interfaces/execution-event-bus.interface';
import { ExecutionEventDTO } from '@lg-agent/contracts';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class InMemoryExecutionEventBus implements IExecutionEventBus {
  private subjects = new Map<string, Subject<ExecutionEventDTO>>();

  publish(executionId: string, event: ExecutionEventDTO): void {
    if (!this.subjects.has(executionId)) {
      this.subjects.set(executionId, new Subject<ExecutionEventDTO>());
    }
    this.subjects.get(executionId)!.next(event);
  }

  subscribe(executionId: string): Observable<ExecutionEventDTO> {
    if (!this.subjects.has(executionId)) {
      this.subjects.set(executionId, new Subject<ExecutionEventDTO>());
    }
    return this.subjects.get(executionId)!.asObservable();
  }

  complete(executionId: string): void {
    const subject = this.subjects.get(executionId);
    if (subject) {
      subject.complete();
      this.subjects.delete(executionId);
    }
  }
}
