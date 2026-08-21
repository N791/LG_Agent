import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { EvidenceDTO, RetrievalFilterDTO, RetrievalRouteDTO } from '@lg-agent/contracts';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: Set<string>;
}

export interface IndexCacheKeyInput {
  organizationId: string;
  sourceId: string;
  versionOrCommit: string;
  parserVersion: string;
  chunkerVersion: string;
  embeddingVersion: string;
}

export interface RetrievalCacheKeyInput {
  organizationId: string;
  aclFingerprint: string;
  query: string;
  routes: RetrievalRouteDTO[];
  filters: RetrievalFilterDTO;
  retrievalPolicyVersion: string;
  sourceVersions: string[];
  safetyPolicyVersion: string;
}

@Injectable()
export class RetrievalCacheService {
  private readonly entries = new Map<string, CacheEntry<EvidenceDTO[]>>();
  private readonly maxEntries = 250;
  private readonly ttlMs = 60_000;

  indexKey(input: IndexCacheKeyInput): string {
    return this.hash([
      input.organizationId,
      input.sourceId,
      input.versionOrCommit,
      input.parserVersion,
      input.chunkerVersion,
      input.embeddingVersion,
    ]);
  }

  retrievalKey(input: RetrievalCacheKeyInput): string {
    return this.hash([
      input.organizationId,
      input.aclFingerprint,
      input.query.trim().toLowerCase(),
      [...input.routes].sort(),
      input.filters,
      [...input.sourceVersions].sort(),
      input.retrievalPolicyVersion,
      input.safetyPolicyVersion,
    ]);
  }

  get(key: string): EvidenceDTO[] | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.value);
  }

  set(key: string, evidence: EvidenceDTO[], tags: string[]): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }
    this.entries.set(key, {
      value: structuredClone(evidence.map((item) => this.redact(item))),
      expiresAt: Date.now() + this.ttlMs,
      tags: new Set(tags),
    });
  }

  invalidate(tags: string[]): number {
    const changed = new Set(tags);
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if ([...entry.tags].some((tag) => changed.has(tag))) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  private redact(evidence: EvidenceDTO): EvidenceDTO {
    const content = evidence.content
      .replace(/\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+/gi, '[REDACTED]')
      .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]');
    const additionalCitations = evidence.metadata?.['additionalCitations'];
    return {
      ...evidence,
      content,
      metadata: Array.isArray(additionalCitations) ? { additionalCitations } : undefined,
    };
  }

  private hash(parts: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }
}
