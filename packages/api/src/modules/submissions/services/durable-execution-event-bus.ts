import { Injectable } from '@nestjs/common';
import { ExecutionEventDTO, SubmissionStatus } from '@lg-agent/contracts';
import { Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../../../common/prisma.service';
import {
  IExecutionEventBus,
  SequencedExecutionEvent,
} from '../interfaces/execution-event-bus.interface';
import { TERMINAL_SUBMISSION_STATUSES } from '../submission-state-machine';

@Injectable()
export class DurableExecutionEventBus implements IExecutionEventBus {
  private readonly live = new Map<string, Subject<SequencedExecutionEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  async publish(submissionId: string, event: ExecutionEventDTO): Promise<SequencedExecutionEvent> {
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM submissions WHERE id = ${submissionId}::uuid FOR UPDATE`;
      const latest = await tx.executionEvent.aggregate({
        where: { submissionId },
        _max: { sequence: true },
      });
      return tx.executionEvent.create({
        data: {
          submissionId,
          sequence: (latest._max.sequence ?? 0) + 1,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    });
    const sequenced = { ...event, sequence: record.sequence };
    this.subject(submissionId).next(sequenced);
    return sequenced;
  }

  subscribe(submissionId: string, afterSequence = 0): Observable<SequencedExecutionEvent> {
    return new Observable((subscriber) => {
      let lastSequence = afterSequence;
      const buffered: SequencedExecutionEvent[] = [];
      const replayState = { active: true, completed: false };
      const liveSubscription = this.subject(submissionId).subscribe({
        next: (event) => {
          if (replayState.active) buffered.push(event);
          else if (event.sequence > lastSequence) {
            lastSequence = event.sequence;
            subscriber.next(event);
          }
        },
        error: (error: unknown) => {
          subscriber.error(error);
        },
        complete: () => {
          if (replayState.active) replayState.completed = true;
          else subscriber.complete();
        },
      });

      void (async () => {
        try {
          const [events, submission] = await Promise.all([
            this.prisma.executionEvent.findMany({
              where: { submissionId, sequence: { gt: afterSequence } },
              orderBy: { sequence: 'asc' },
            }),
            this.prisma.submission.findUnique({
              where: { id: submissionId },
              select: { status: true },
            }),
          ]);
          for (const record of events) {
            const event = record.payload as unknown as ExecutionEventDTO;
            lastSequence = record.sequence;
            subscriber.next({ ...event, sequence: record.sequence });
          }
          replayState.active = false;
          for (const event of buffered) {
            if (event.sequence > lastSequence) {
              lastSequence = event.sequence;
              subscriber.next(event);
            }
          }
          if (
            replayState.completed ||
            (submission && TERMINAL_SUBMISSION_STATUSES.has(submission.status as SubmissionStatus))
          ) {
            subscriber.complete();
          }
        } catch (error: unknown) {
          subscriber.error(error);
        }
      })();

      return () => {
        liveSubscription.unsubscribe();
        buffered.length = 0;
      };
    });
  }

  complete(submissionId: string): Promise<void> {
    const subject = this.live.get(submissionId);
    subject?.complete();
    this.live.delete(submissionId);
    return Promise.resolve();
  }

  private subject(submissionId: string): Subject<SequencedExecutionEvent> {
    let subject = this.live.get(submissionId);
    if (!subject || subject.closed) {
      subject = new Subject<SequencedExecutionEvent>();
      this.live.set(submissionId, subject);
    }
    return subject;
  }
}
