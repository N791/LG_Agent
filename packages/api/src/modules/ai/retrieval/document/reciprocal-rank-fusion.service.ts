import { Injectable } from '@nestjs/common';
import type {
  DocumentCandidate,
  FusedDocumentCandidate,
  RetrievalChannel,
} from './hybrid-retrieval.interfaces';

@Injectable()
export class ReciprocalRankFusionService {
  fuse(
    channels: Partial<Record<RetrievalChannel, DocumentCandidate[]>>,
    options: { rankConstant?: number; weights?: Partial<Record<RetrievalChannel, number>> } = {},
  ): FusedDocumentCandidate[] {
    const rankConstant = Math.max(1, options.rankConstant ?? 60);
    const byChunk = new Map<string, FusedDocumentCandidate>();

    for (const channel of ['keyword', 'vector'] as const) {
      const weight = Math.max(0, options.weights?.[channel] ?? 1);
      channels[channel]?.forEach((candidate, index) => {
        const rawRank = candidate.rawRank || index + 1;
        const contribution = weight / (rankConstant + rawRank);
        const existing = byChunk.get(candidate.chunkId);
        if (existing) {
          existing.fusedScore += contribution;
          existing.channels[channel] = {
            rawRank,
            rawScore: candidate.rawScore,
            hitReason: candidate.hitReason,
          };
        } else {
          byChunk.set(candidate.chunkId, {
            ...candidate,
            rawRank,
            channels: {
              [channel]: {
                rawRank,
                rawScore: candidate.rawScore,
                hitReason: candidate.hitReason,
              },
            },
            fusedScore: contribution,
            fusedRank: 0,
          });
        }
      });
    }
    return [...byChunk.values()]
      .sort(
        (left, right) =>
          right.fusedScore - left.fusedScore || left.chunkId.localeCompare(right.chunkId),
      )
      .map((candidate, index) => ({ ...candidate, fusedRank: index + 1 }));
  }
}
