import { Injectable, Logger } from '@nestjs/common';
import type { IRetrievalObserver, RetrievalStageObservation } from './hybrid-retrieval.interfaces';
import { RetrievalObservabilityService } from '../retrieval-observability.service';

@Injectable()
export class RetrievalObserverService implements IRetrievalObserver {
  private readonly logger = new Logger(RetrievalObserverService.name);

  constructor(private readonly metrics: RetrievalObservabilityService) {}

  observe(observation: RetrievalStageObservation): void {
    const message = JSON.stringify({
      event: 'document_retrieval_stage',
      ...observation,
    });
    if (observation.status === 'ok') this.logger.debug(message);
    else this.logger.warn(message);
    this.metrics.observe(observation.stage === 'rerank' ? 'reranker' : 'document', observation);
  }
}
