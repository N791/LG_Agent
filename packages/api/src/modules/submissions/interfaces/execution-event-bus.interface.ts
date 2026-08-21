import { ExecutionEventDTO } from '@lg-agent/contracts';
import { Observable } from 'rxjs';

export interface SequencedExecutionEvent extends ExecutionEventDTO {
  sequence: number;
}

export interface IExecutionEventBus {
  publish(executionId: string, event: ExecutionEventDTO): Promise<SequencedExecutionEvent>;
  subscribe(executionId: string, afterSequence?: number): Observable<SequencedExecutionEvent>;
  complete(executionId: string): Promise<void>;
}

export const EXECUTION_EVENT_BUS = Symbol('IExecutionEventBus');
