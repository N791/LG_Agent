import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RetrievalRolloutMode = 'LEGACY' | 'SHADOW' | 'ACTIVE';

export interface RetrievalRolloutDecision {
  mode: RetrievalRolloutMode;
  shadowRead: boolean;
  useVersionedResult: boolean;
}

export interface RetrievalRolloutScope {
  organizationId: string;
  courseId?: string;
  userId?: string;
}

@Injectable()
export class RetrievalFeatureFlags {
  constructor(private readonly config: ConfigService) {}

  forOrganization(
    organizationId: string,
    userId?: string,
    courseId?: string,
  ): RetrievalRolloutDecision {
    return this.forScope({
      organizationId,
      ...(courseId && { courseId }),
      ...(userId && { userId }),
    });
  }

  forScope(scope: RetrievalRolloutScope): RetrievalRolloutDecision {
    const globalMode = this.parseMode(this.config.get<string>('RETRIEVAL_ROLLOUT_MODE', 'LEGACY'));
    const organizationEnabled = this.values('RETRIEVAL_ROLLOUT_ORGANIZATIONS').has(
      scope.organizationId,
    );
    const courseEnabled =
      scope.courseId !== undefined && this.values('RETRIEVAL_ROLLOUT_COURSES').has(scope.courseId);
    const userEnabled =
      scope.userId !== undefined && this.values('RETRIEVAL_ROLLOUT_USERS').has(scope.userId);
    const allowAll = this.config.get<string>('RETRIEVAL_ROLLOUT_ORGANIZATIONS', '') === '*';
    const mode =
      allowAll || organizationEnabled || courseEnabled || userEnabled ? globalMode : 'LEGACY';
    return {
      mode,
      shadowRead: mode === 'SHADOW',
      useVersionedResult: mode === 'ACTIVE',
    };
  }

  featureEnabled(
    feature: 'QUERY_ROUTER' | 'CODE_RETRIEVAL' | 'PROGRESSIVE_DISCLOSURE',
    scope: RetrievalRolloutScope,
  ): boolean {
    if (this.forScope(scope).mode !== 'ACTIVE') return false;
    const disabled = this.values(`RETRIEVAL_DISABLED_${feature}`);
    return (
      !disabled.has(scope.organizationId) &&
      !disabled.has(scope.courseId ?? '') &&
      !disabled.has(scope.userId ?? '')
    );
  }

  private values(name: string): Set<string> {
    return new Set(
      this.config
        .get<string>(name, '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  private parseMode(value: string): RetrievalRolloutMode {
    return value === 'ACTIVE' || value === 'SHADOW' ? value : 'LEGACY';
  }
}
