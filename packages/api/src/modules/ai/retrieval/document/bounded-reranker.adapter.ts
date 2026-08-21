import { Injectable } from '@nestjs/common';
import type { FusedDocumentCandidate, IDocumentReranker } from './hybrid-retrieval.interfaces';

@Injectable()
export class BoundedLexicalRerankerAdapter implements IDocumentReranker {
  rerank(query: string, candidates: FusedDocumentCandidate[]): Promise<FusedDocumentCandidate[]> {
    const terms = new Set(
      query
        .normalize('NFKC')
        .toLowerCase()
        .match(/[\p{Letter}\p{Number}_-]+/gu) ?? [],
    );
    return Promise.resolve(
      candidates
        .map((candidate) => {
          const normalized = candidate.content.normalize('NFKC').toLowerCase();
          const matched = [...terms].filter((term) => normalized.includes(term)).length;
          const coverage = terms.size === 0 ? 0 : matched / terms.size;
          return { ...candidate, rerankScore: candidate.fusedScore + coverage };
        })
        .sort(
          (left, right) => right.rerankScore - left.rerankScore || left.fusedRank - right.fusedRank,
        )
        .map((candidate, index) => ({ ...candidate, fusedRank: index + 1 })),
    );
  }
}
