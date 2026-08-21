import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DisclosureLevelDTO,
  RetrievalRouteDTO,
  type DisclosureUpgradeDTO,
  type EvidenceDTO,
  type OrchestrateContextInputDTO,
  type RouteQueryResultDTO,
  type RetrievalToolResultDTO,
} from '@lg-agent/contracts';
import {
  CODE_RETRIEVER,
  DOCUMENT_RETRIEVER,
  QUERY_ROUTER,
  type ICodeRetriever,
  type IContextOrchestrator,
  type IDocumentRetriever,
  type IQueryRouter,
} from './interfaces';
import { ContextBudgetService } from './context-budget.service';
import { RetrievalCacheService } from './retrieval-cache.service';
import { RetrievalFeatureFlags } from './retrieval-feature-flags.service';
import { RetrievalSecurityService } from './retrieval-security.service';
import { RetrievalTraceService } from './retrieval-trace.service';
import { RetrievalObservabilityService } from './retrieval-observability.service';
import type { RetrievalTraceStageDTO, RetrievalTraceToolCallDTO } from '@lg-agent/contracts';

@Injectable()
export class ContextOrchestratorService implements IContextOrchestrator {
  constructor(
    @Inject(DOCUMENT_RETRIEVER) private readonly documents: IDocumentRetriever,
    @Inject(CODE_RETRIEVER) private readonly code: ICodeRetriever,
    @Inject(QUERY_ROUTER) private readonly router: IQueryRouter,
    private readonly featureFlags: RetrievalFeatureFlags,
    private readonly budgets: ContextBudgetService,
    private readonly cache: RetrievalCacheService,
    @Optional()
    private readonly security: RetrievalSecurityService = new RetrievalSecurityService(),
    @Optional() private readonly traces: RetrievalTraceService = new RetrievalTraceService(),
    @Optional()
    private readonly observability: RetrievalObservabilityService = new RetrievalObservabilityService(),
  ) {}

  async retrieve(input: OrchestrateContextInputDTO): Promise<RetrievalToolResultDTO> {
    const startedAt = Date.now();
    const stages: RetrievalTraceStageDTO[] = [];
    const toolCalls: RetrievalTraceToolCallDTO[] = [];
    const routeStartedAt = Date.now();
    const rolloutScope = {
      organizationId: input.organizationId,
      userId: input.userId,
      ...(input.courseId && { courseId: input.courseId }),
    };
    const rolloutDecision = this.featureFlags.forScope(rolloutScope);
    const queryRouterEnabled =
      rolloutDecision.mode !== 'ACTIVE' ||
      this.featureFlags.featureEnabled('QUERY_ROUTER', rolloutScope);
    const routed = queryRouterEnabled
      ? await this.router.route(input)
      : this.legacyDocumentRoute(input);
    stages.push({
      name: 'query_router',
      durationMs: Date.now() - routeStartedAt,
      candidateCount: 0,
      status: 'OK',
    });
    let routes = this.expandMixedRoute(routed.plan.routes);
    if (
      rolloutDecision.mode === 'ACTIVE' &&
      !this.featureFlags.featureEnabled('CODE_RETRIEVAL', rolloutScope)
    ) {
      routes = routes.filter((route) => route !== RetrievalRouteDTO.CODE);
      if (!routes.length) routes = [RetrievalRouteDTO.DOCUMENT];
    }
    const progressiveEnabled =
      rolloutDecision.mode !== 'ACTIVE' ||
      this.featureFlags.featureEnabled('PROGRESSIVE_DISCLOSURE', rolloutScope);
    const requestedLevel = progressiveEnabled
      ? (input.disclosureLevel ?? DisclosureLevelDTO.L0)
      : DisclosureLevelDTO.L0;
    const limit = Math.max(1, input.maxEvidence ?? routed.plan.candidateLimit);
    const scope = {
      organizationId: input.organizationId,
      userId: input.userId,
      courseId: input.courseId,
      taskId: input.taskId,
      conversationId: input.conversationId,
    };
    const cacheKey = this.cache.retrievalKey({
      organizationId: input.organizationId,
      aclFingerprint: input.aclFingerprint ?? `user:${input.userId}`,
      query: routed.plan.rewrittenQuery,
      routes,
      filters: routed.plan.filters,
      retrievalPolicyVersion: routed.policyVersion,
      sourceVersions: input.sourceVersions ?? [],
      safetyPolicyVersion: input.safetyPolicyVersion ?? 'retrieval-safety.v1',
    });
    const cacheable = (input.sourceVersions?.length ?? 0) > 0;
    const cacheStartedAt = Date.now();
    const cached = cacheable ? this.cache.get(cacheKey) : undefined;
    this.observability.observe('cache', {
      durationMs: Date.now() - cacheStartedAt,
      status: 'ok',
    });
    const recallStartedAt = Date.now();
    let evidence =
      cached ??
      (await this.security.withTimeout(
        'candidate recall',
        this.security.limits.searchTimeoutMs,
        () => this.retrieveL0(input, routed.plan.rewrittenQuery, routes, limit, scope),
      ));
    evidence = this.security.enforceEvidence(evidence, scope, 'RECALL');
    stages.push({
      name: 'candidate_recall_acl',
      durationMs: Date.now() - recallStartedAt,
      candidateCount: evidence.length,
      status: 'OK',
      aclStage: 'RECALL',
    });
    if (routes.includes(RetrievalRouteDTO.CODE)) {
      this.observability.observe('code', {
        durationMs: Date.now() - recallStartedAt,
        status: 'ok',
      });
    }
    const totalCandidates = evidence.length;
    const disclosureUpgrades: DisclosureUpgradeDTO[] = [];

    if (!cached && cacheable) {
      this.cache.set(cacheKey, evidence, [
        `organization:${input.organizationId}`,
        `acl:${input.aclFingerprint ?? `user:${input.userId}`}`,
        ...(input.sourceVersions ?? []).map((version) => `version:${version}`),
        `safety:${input.safetyPolicyVersion ?? 'retrieval-safety.v1'}`,
      ]);
    }

    if (requestedLevel !== DisclosureLevelDTO.L0) {
      const expansionStartedAt = Date.now();
      const upgraded = await this.upgradeEvidence(
        evidence,
        requestedLevel,
        scope,
        'caller-requested-more-context',
      );
      evidence = upgraded.evidence;
      disclosureUpgrades.push(...upgraded.upgrades);
      evidence = this.security.enforceEvidence(evidence, scope, 'EXPANSION');
      stages.push({
        name: 'expansion_acl',
        durationMs: Date.now() - expansionStartedAt,
        candidateCount: evidence.length,
        status: 'OK',
        aclStage: 'EXPANSION',
      });
    }

    const assemblyStartedAt = Date.now();
    const fitted = this.budgets.fit(
      evidence.slice(0, limit),
      this.budgets.allocate(input.totalTokenBudget),
      this.security.limits.maxEvidenceTokens,
    );
    this.security.assertDuration(
      'context assembly',
      assemblyStartedAt,
      this.security.limits.assemblyTimeoutMs,
    );
    stages.push({
      name: 'context_assembly',
      durationMs: Date.now() - assemblyStartedAt,
      candidateCount: fitted.evidence.length,
      status: fitted.budget.truncated ? 'DEGRADED' : 'OK',
      ...(fitted.budget.truncated && { reasonCode: 'TOKEN_BUDGET_TRUNCATED' }),
    });
    const rollout = rolloutDecision;
    const citations = fitted.evidence.flatMap((item) => [
      item.citation,
      ...((item.metadata?.['additionalCitations'] as EvidenceDTO['citation'][] | undefined) ?? []),
    ]);
    const traceId = randomUUID();
    const durationMs = Date.now() - startedAt;
    for (const route of routes) {
      if (route === RetrievalRouteDTO.DOCUMENT) {
        toolCalls.push({
          name: 'search_documents',
          durationMs: stages.find(({ name }) => name === 'candidate_recall_acl')?.durationMs ?? 0,
          resultCount: fitted.evidence.filter(({ route: value }) => value === route).length,
          status: 'OK',
        });
      }
      if (route === RetrievalRouteDTO.CODE) {
        toolCalls.push({
          name: 'search_symbols',
          durationMs: stages.find(({ name }) => name === 'candidate_recall_acl')?.durationMs ?? 0,
          resultCount: fitted.evidence.filter(({ route: value }) => value === route).length,
          status: 'OK',
        });
      }
    }
    this.traces.record({
      traceId,
      organizationId: input.organizationId,
      route: routed.route,
      policyVersion: routed.policyVersion,
      cacheHit: Boolean(cached),
      tokenUsed: fitted.budget.usedEvidence,
      durationMs,
      evidence: fitted.evidence,
      stages,
      toolCalls,
    });
    return {
      evidence: fitted.evidence,
      trace: {
        traceId,
        organizationId: input.organizationId,
        route: routed.route,
        disclosureLevel: requestedLevel,
        evidenceCount: fitted.evidence.length,
        totalCandidates,
        durationMs,
        cacheHit: Boolean(cached),
        shadowRead: rollout.shadowRead,
        createdAt: new Date().toISOString(),
        policyVersion: routed.policyVersion,
        routeReasons: routed.reasons,
        tokenBudget: fitted.budget,
        disclosureUpgrades,
        stages,
        evidence: fitted.evidence.map((item) => ({
          evidenceId: item.id,
          route: item.route,
          revision: item.citation.revision,
          score: item.score,
          citationId: item.citation.id,
          disclosureLevel: item.disclosureLevel,
        })),
        toolCalls,
        degraded: fitted.budget.truncated,
        ...(fitted.budget.truncated && { degradationReasons: ['TOKEN_BUDGET_TRUNCATED'] }),
      },
      context: {
        organizationId: input.organizationId,
        route: routed.route,
        policyVersion: routed.policyVersion,
        evidence: fitted.evidence,
        citations,
        budget: fitted.budget,
        disclosureUpgrades,
        cacheKey: cacheable ? cacheKey : undefined,
      },
    };
  }

  private async retrieveL0(
    input: OrchestrateContextInputDTO,
    query: string,
    routes: RetrievalRouteDTO[],
    limit: number,
    scope: {
      organizationId: string;
      userId: string;
      taskId?: string;
      conversationId?: string;
    },
  ): Promise<EvidenceDTO[]> {
    const jobs: Promise<EvidenceDTO[]>[] = [];
    if (routes.includes(RetrievalRouteDTO.DOCUMENT)) {
      jobs.push(
        this.documents.searchDocuments({
          ...scope,
          query,
          topK: limit,
          disclosureLevel: DisclosureLevelDTO.L0,
          knowledgeSourceIds: input.filters?.knowledgeSourceIds,
          documentVersionIds: input.filters?.documentVersionIds,
          metadataFilters: input.filters?.metadata,
        }),
      );
    }
    if (routes.includes(RetrievalRouteDTO.CODE)) {
      jobs.push(
        this.code.searchSymbols({
          ...scope,
          query,
          topK: limit,
          disclosureLevel: DisclosureLevelDTO.L0,
          repositorySnapshotId:
            input.filters?.repositorySnapshotId ?? input.activeFile?.repositorySnapshotId,
        }),
      );
    }
    if (routes.includes(RetrievalRouteDTO.TASK_STATE) && input.taskState) {
      jobs.push(
        Promise.resolve([
          this.inlineEvidence(input, RetrievalRouteDTO.TASK_STATE, input.taskState),
        ]),
      );
    }
    if (routes.includes(RetrievalRouteDTO.CONVERSATION) && input.recentConversation) {
      jobs.push(
        Promise.resolve([
          this.inlineEvidence(input, RetrievalRouteDTO.CONVERSATION, input.recentConversation),
        ]),
      );
    }

    return (await Promise.all(jobs))
      .flat()
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  private async upgradeEvidence(
    evidence: EvidenceDTO[],
    target: DisclosureLevelDTO,
    scope: {
      organizationId: string;
      userId: string;
      taskId?: string;
      conversationId?: string;
    },
    reason: string,
  ): Promise<{ evidence: EvidenceDTO[]; upgrades: DisclosureUpgradeDTO[] }> {
    const expanded = await Promise.all(
      evidence.map(async (item): Promise<EvidenceDTO[]> => {
        if (item.route === RetrievalRouteDTO.DOCUMENT) {
          return this.documents.expandDocument({
            ...scope,
            evidenceId: item.id,
            disclosureLevel: target,
          });
        }
        if (
          item.route === RetrievalRouteDTO.CODE &&
          item.citation.repositorySnapshotId &&
          item.citation.symbolId
        ) {
          if (target === DisclosureLevelDTO.L2) {
            return this.code.expandSymbol({
              ...scope,
              repositorySnapshotId: item.citation.repositorySnapshotId,
              symbolId: item.citation.symbolId,
              disclosureLevel: target,
              relationTypes: ['CALLS', 'CALLED_BY', 'TESTED_BY'],
              depth: 1,
              limit: 8,
            });
          }
          return this.code.readSymbol({
            ...scope,
            repositorySnapshotId: item.citation.repositorySnapshotId,
            symbolId: item.citation.symbolId,
            disclosureLevel: target,
          });
        }
        return [{ ...item, disclosureLevel: target }];
      }),
    );
    const result = expanded.flat();
    return {
      evidence: result,
      upgrades: evidence.map((item, index) => {
        const additions = expanded[index] ?? [];
        return {
          evidenceId: item.id,
          from: DisclosureLevelDTO.L0,
          to: target,
          reason,
          tokensConsumed: additions.reduce(
            (total, addition) => total + this.budgets.estimateTokens(addition.content),
            0,
          ),
          addedEvidenceIds: additions.map(({ id }) => id),
        };
      }),
    };
  }

  private inlineEvidence(
    input: OrchestrateContextInputDTO,
    route: RetrievalRouteDTO.TASK_STATE | RetrievalRouteDTO.CONVERSATION,
    content: string,
  ): EvidenceDTO {
    const revision =
      route === RetrievalRouteDTO.TASK_STATE
        ? (input.taskStage ?? input.sourceVersions?.[0] ?? 'current')
        : (input.conversationId ?? 'current');
    const id = `${route.toLowerCase()}:${revision}`;
    return {
      id,
      organizationId: input.organizationId,
      route,
      disclosureLevel: DisclosureLevelDTO.L0,
      content,
      score: 0.85,
      citation: {
        id,
        organizationId: input.organizationId,
        title: route === RetrievalRouteDTO.TASK_STATE ? 'Task state' : 'Conversation summary',
        uri: `${route.toLowerCase()}://${revision}`,
        revision,
        locator: { anchor: id },
      },
    };
  }

  private expandMixedRoute(routes: RetrievalRouteDTO[]): RetrievalRouteDTO[] {
    return [
      ...new Set(
        routes.flatMap((route) =>
          route === RetrievalRouteDTO.MIXED
            ? [RetrievalRouteDTO.DOCUMENT, RetrievalRouteDTO.CODE]
            : [route],
        ),
      ),
    ];
  }

  private legacyDocumentRoute(input: OrchestrateContextInputDTO): RouteQueryResultDTO {
    return {
      route: RetrievalRouteDTO.DOCUMENT,
      confidence: 1,
      reasons: ['query-router-disabled-by-rollout-policy'],
      policyVersion: 'retrieval-rollout-legacy-document.v1',
      plan: {
        primaryRoute: RetrievalRouteDTO.DOCUMENT,
        routes: [RetrievalRouteDTO.DOCUMENT],
        rewrittenQuery: input.query.trim(),
        filters: input.filters ?? {},
        candidateLimit: Math.max(1, input.maxEvidence ?? 5),
        targetDisclosureLevel: DisclosureLevelDTO.L0,
        suggestedEvidenceTokens: 1_024,
        lowConfidenceFallback: false,
      },
    };
  }
}
