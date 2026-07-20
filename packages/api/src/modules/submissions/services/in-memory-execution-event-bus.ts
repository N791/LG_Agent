import { Injectable } from '@nestjs/common';
import { IExecutionEventBus } from '../interfaces/execution-event-bus.interface';
import { ExecutionEventDTO } from '@lg-agent/contracts';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class InMemoryExecutionEventBus implements IExecutionEventBus {
  private subjects = new Map<string, Subject<ExecutionEventDTO>>();

  publish(executionId: string, event: ExecutionEventDTO): void {
    let subject = this.subjects.get(executionId);
    if (!subject) {
      subject = new Subject<ExecutionEventDTO>();
      this.subjects.set(executionId, subject);
    }
    subject.next(event);
  }

  subscribe(executionId: string): Observable<ExecutionEventDTO> {
    let subject = this.subjects.get(executionId);
    if (!subject) {
      subject = new Subject<ExecutionEventDTO>();
      this.subjects.set(executionId, subject);
    }
    return subject.asObservable();
  }

  complete(executionId: string): void {
    const subject = this.subjects.get(executionId);
    if (subject) {
      subject.complete();
      this.subjects.delete(executionId);
    }
  }
}
