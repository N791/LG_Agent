import { Injectable } from '@nestjs/common';

export type RetrievalMigrationPhase =
  'EXPAND' | 'BACKFILL_INDEX' | 'SHADOW_EVALUATE' | 'SWITCH' | 'CLEANUP';

const PHASES: RetrievalMigrationPhase[] = [
  'EXPAND',
  'BACKFILL_INDEX',
  'SHADOW_EVALUATE',
  'SWITCH',
  'CLEANUP',
];

export interface RecoverableIndexVersion {
  id: string;
  status: 'BUILDING' | 'READY' | 'FAILED';
  active: boolean;
  createdAt: string;
}

export interface RetrievalRecoveryCheck {
  postgres: boolean;
  pgvector: boolean;
  objectStorage: boolean;
  codeIndexArtifacts: boolean;
}

@Injectable()
export class RetrievalRolloutService {
  private readonly phases = new Map<string, RetrievalMigrationPhase>();

  phase(scopeId: string): RetrievalMigrationPhase {
    return this.phases.get(scopeId) ?? 'EXPAND';
  }

  advance(scopeId: string, next: RetrievalMigrationPhase): void {
    const current = this.phase(scopeId);
    const currentIndex = PHASES.indexOf(current);
    if (PHASES.indexOf(next) !== currentIndex + 1) {
      throw new Error(
        `Retrieval migration must advance from ${current} to ${PHASES[currentIndex + 1] ?? 'complete'}.`,
      );
    }
    this.phases.set(scopeId, next);
  }

  cleanupCandidates(versions: RecoverableIndexVersion[]): string[] {
    const ready = versions
      .filter(({ status }) => status === 'READY')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const protectedIds = new Set([
      ...ready.filter(({ active }) => active).map(({ id }) => id),
      ...ready
        .filter(({ active }) => !active)
        .slice(0, 1)
        .map(({ id }) => id),
    ]);
    return versions
      .filter(({ id, status }) => status !== 'BUILDING' && !protectedIds.has(id))
      .map(({ id }) => id);
  }

  assertRecovery(check: RetrievalRecoveryCheck): void {
    const failed = Object.entries(check)
      .filter(([, passed]) => !passed)
      .map(([component]) => component);
    if (failed.length) {
      throw new Error(`Retrieval backup recovery verification failed: ${failed.join(', ')}`);
    }
  }
}
