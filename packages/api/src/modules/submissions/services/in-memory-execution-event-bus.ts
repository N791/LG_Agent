import { Injectable } from '@nestjs/common';
import {
  IExecutionEventBus,
  SequencedExecutionEvent,
} from '../interfaces/execution-event-bus.interface';
import { ExecutionEventDTO } from '@lg-agent/contracts';
import { ReplaySubject, Observable } from 'rxjs';

@Injectable()
export class InMemoryExecutionEventBus implements IExecutionEventBus {
  private subjects = new Map<string, ReplaySubject<SequencedExecutionEvent>>();
  private sequences = new Map<string, number>();

  publish(executionId: string, event: ExecutionEventDTO): Promise<SequencedExecutionEvent> {
    let subject = this.subjects.get(executionId);
    if (!subject) {
      subject = new ReplaySubject<SequencedExecutionEvent>(1000);
      this.subjects.set(executionId, subject);
    }
    const sequenced = {
      ...event,
      sequence: (this.sequences.get(executionId) ?? 0) + 1,
    };
    this.sequences.set(executionId, sequenced.sequence);
    subject.next(sequenced);
    return Promise.resolve(sequenced);
  }

  subscribe(executionId: string, afterSequence = 0): Observable<SequencedExecutionEvent> {
    let subject = this.subjects.get(executionId);
    if (!subject) {
      subject = new ReplaySubject<SequencedExecutionEvent>(1000);
      this.subjects.set(executionId, subject);
    }
    return new Observable((subscriber) =>
      subject.subscribe({
        next: (event) => {
          if (event.sequence > afterSequence) subscriber.next(event);
        },
        error: (error: unknown) => {
          subscriber.error(error);
        },
        complete: () => {
          subscriber.complete();
        },
      }),
    );
  }

  complete(executionId: string): Promise<void> {
    const subject = this.subjects.get(executionId);
    if (subject) {
      subject.complete();
      const timer = setTimeout(() => this.subjects.delete(executionId), 5 * 60 * 1000);
      timer.unref();
    }
    return Promise.resolve();
  }
}
