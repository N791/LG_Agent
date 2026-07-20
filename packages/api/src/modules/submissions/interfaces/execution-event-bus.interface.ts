import { ExecutionEventDTO } from '@lg-agent/contracts';
import { Observable } from 'rxjs';

export interface IExecutionEventBus {
  publish(executionId: string, event: ExecutionEventDTO): void;
  subscribe(executionId: string): Observable<ExecutionEventDTO>;
  complete(executionId: string): void;
}

export const EXECUTION_EVENT_BUS = Symbol('IExecutionEventBus');
