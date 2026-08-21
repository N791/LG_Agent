import { Injectable } from '@nestjs/common';
import { LLMGatewayService } from '../../gateway/llm-gateway.service';
import type { IDocumentEmbeddingProvider } from './structured-document-index.service';

@Injectable()
export class GatewayDocumentEmbeddingAdapter implements IDocumentEmbeddingProvider {
  constructor(private readonly gateway: LLMGatewayService) {}

  embed(texts: string[]): Promise<number[][]> {
    return this.gateway.embed(texts);
  }
}
