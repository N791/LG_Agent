import { ConfigService } from '@nestjs/config';
import { DisclosureLevelDTO, RetrievalRouteDTO, type EvidenceDTO } from '@lg-agent/contracts';
import { ContextBudgetService } from './context-budget.service';
import { ContextOrchestratorService } from './context-orchestrator.service';
import { ConversationCompactorService } from './conversation-compactor.service';
import type { ICodeRetriever, IDocumentRetriever } from './interfaces';
import { QueryRouterService } from './query-router.service';
import { RetrievalCacheService } from './retrieval-cache.service';
import { RetrievalFeatureFlags } from './retrieval-feature-flags.service';
import goldenDataset from './evaluation/query-router-golden.json';

const scope = {
  organizationId: '22222222-2222-4222-8222-222222222222',
  userId: '11111111-1111-4111-8111-111111111111',
  taskId: '33333333-3333-4333-8333-333333333333',
  conversationId: '44444444-4444-4444-8444-444444444444',
};

function evidence(
  route: RetrievalRouteDTO,
  id: string,
  content = `${route} evidence`,
): EvidenceDTO {
  return {
    id,
    organizationId: scope.organizationId,
    route,
    disclosureLevel: DisclosureLevelDTO.L0,
    content,
    score: 0.9,
    citation: {
      id: `citation-${id}`,
      organizationId: scope.organizationId,
      title: id,
      uri: `test://${id}`,
      revision: 'v1',
      locator: { anchor: id },
      ...(route === RetrievalRouteDTO.CODE
        ? { repositorySnapshotId: 'snapshot-1', symbolId: 'symbol-1' }
        : {}),
    },
  };
}

describe('Epic 77 query routing and progressive context', () => {
  it('uses all routing signals and falls back to bounded mixed retrieval', async () => {
    const router = new QueryRouterService();
    const planned = await router.route({
      ...scope,
      query: 'Does this function satisfy the policy requirement?',
      activeFile: { path: 'src/check.ts', repositorySnapshotId: 'snapshot-1' },
      taskState: 'Implementation',
      recentConversation: 'We decided to verify the policy.',
    });
    expect(planned.route).toBe(RetrievalRouteDTO.MIXED);
    expect(planned.plan.routes).toEqual(
      expect.arrayContaining([
        RetrievalRouteDTO.DOCUMENT,
        RetrievalRouteDTO.CODE,
        RetrievalRouteDTO.TASK_STATE,
        RetrievalRouteDTO.CONVERSATION,
      ]),
    );
    expect(planned.plan.targetDisclosureLevel).toBe(DisclosureLevelDTO.L0);
    expect(planned.policyVersion).toBe('query-router.v1');

    const unknown = await router.route({ ...scope, query: 'help me understand this' });
    expect(unknown.plan.lowConfidenceFallback).toBe(true);
    expect(unknown.plan.routes).toEqual([RetrievalRouteDTO.DOCUMENT, RetrievalRouteDTO.CODE]);
    expect(unknown.plan.candidateLimit).toBe(3);

    await expect(
      router.route({
        ...scope,
        query: '\u54ea\u4e2a\u51fd\u6570\u5b9e\u73b0\u4e86\u6587\u6863\u9700\u6c42\uff1f',
      }),
    ).resolves.toMatchObject({ route: RetrievalRouteDTO.MIXED });
  });

  it('passes the versioned offline intent-routing golden set', async () => {
    const router = new QueryRouterService();
    expect(goldenDataset.version).toBe('query-router-golden.v1');
    for (const testCase of goldenDataset.cases) {
      const result = await router.route({
        ...scope,
        query: testCase.query,
        taskState: testCase.taskState,
        recentConversation: testCase.recentConversation,
      });
      expect(result.route).toBe(testCase.expectedRoute);
    }
  });

  it('retrieves document, code, and task evidence in parallel and defaults to L0', async () => {
    const documents: IDocumentRetriever = {
      searchDocuments: jest.fn().mockResolvedValue([evidence(RetrievalRouteDTO.DOCUMENT, 'doc')]),
      expandDocument: jest.fn().mockResolvedValue([]),
    };
    const code: ICodeRetriever = {
      searchSymbols: jest.fn().mockResolvedValue([evidence(RetrievalRouteDTO.CODE, 'code')]),
      readSymbol: jest.fn().mockResolvedValue([]),
      expandSymbol: jest.fn().mockResolvedValue([]),
    };
    const service = new ContextOrchestratorService(
      documents,
      code,
      new QueryRouterService(),
      new RetrievalFeatureFlags(new ConfigService()),
      new ContextBudgetService(),
      new RetrievalCacheService(),
    );
    const result = await service.retrieve({
      ...scope,
      query: 'Which function implements this document requirement for the task?',
      taskState: 'Acceptance testing',
      totalTokenBudget: 2_048,
    });

    expect(result.evidence.map(({ route }) => route)).toEqual(
      expect.arrayContaining([
        RetrievalRouteDTO.DOCUMENT,
        RetrievalRouteDTO.CODE,
        RetrievalRouteDTO.TASK_STATE,
      ]),
    );
    expect(
      result.evidence.every(({ disclosureLevel }) => disclosureLevel === DisclosureLevelDTO.L0),
    ).toBe(true);
    expect(result.context?.budget.total).toBe(2_048);
    expect(result.context?.citations).toHaveLength(3);
  });

  it('keeps cache keys isolated by tenant, ACL, version, and policy and redacts cached content', () => {
    const cache = new RetrievalCacheService();
    const base = {
      organizationId: scope.organizationId,
      aclFingerprint: 'acl-a',
      query: 'policy',
      routes: [RetrievalRouteDTO.DOCUMENT],
      filters: {},
      retrievalPolicyVersion: 'router-v1',
      sourceVersions: ['doc-v1'],
      safetyPolicyVersion: 'safety-v1',
    };
    const key = cache.retrievalKey(base);
    expect(cache.retrievalKey({ ...base, aclFingerprint: 'acl-b' })).not.toBe(key);
    expect(cache.retrievalKey({ ...base, sourceVersions: ['doc-v2'] })).not.toBe(key);
    expect(cache.retrievalKey({ ...base, organizationId: 'other-org' })).not.toBe(key);

    cache.set(
      key,
      [evidence(RetrievalRouteDTO.DOCUMENT, 'doc', 'api_key=plain-secret')],
      ['version:doc-v1'],
    );
    expect(cache.get(key)?.[0]?.content).toBe('[REDACTED]');
    expect(cache.invalidate(['version:doc-v1'])).toBe(1);
    expect(cache.get(key)).toBeUndefined();
  });

  it('trims evidence atomically by marginal value and retains duplicate citations', () => {
    const budget = new ContextBudgetService();
    const sameFact = 'The retry limit is three.';
    const fitted = budget.fit(
      [
        evidence(RetrievalRouteDTO.DOCUMENT, 'doc', sameFact),
        { ...evidence(RetrievalRouteDTO.CODE, 'code', sameFact), score: 0.8 },
      ],
      budget.allocate(1_024),
    );
    expect(fitted.evidence).toHaveLength(1);
    expect(fitted.evidence[0]?.metadata?.['additionalCitations']).toHaveLength(1);
  });

  it('compacts old turns without losing unresolved questions or evidence ids', () => {
    const compactor = new ConversationCompactorService();
    const summary = compactor.compact({
      ...scope,
      keepRecentTurns: 1,
      messages: [
        { id: 'm1', role: 'user', content: 'Can we support retries?', evidenceIds: ['ev-1'] },
        { id: 'm2', role: 'assistant', content: 'We decided to use three retries.' },
        { id: 'm3', role: 'user', content: 'Implement it now.' },
        { id: 'm4', role: 'assistant', content: 'Working on it.' },
      ],
    });
    expect(summary.throughMessageId).toBe('m2');
    expect(summary.unresolvedQuestions).toContain('Can we support retries?');
    expect(summary.evidenceIds).toContain('ev-1');
    expect(summary.retainedMessages.map(({ id }) => id)).toEqual(['m3', 'm4']);

    const refreshed = compactor.compact({
      ...scope,
      keepRecentTurns: 1,
      previousSummary: summary,
      conflictingEvidenceIds: ['ev-1'],
      messages: [
        { id: 'm1', role: 'user', content: 'Can we support retries?', evidenceIds: ['ev-2'] },
        { id: 'm2', role: 'assistant', content: 'Confirmed: the new limit is five.' },
        { id: 'm3', role: 'user', content: 'Continue.' },
        { id: 'm4', role: 'assistant', content: 'Done.' },
      ],
    });
    expect(refreshed.evidenceIds).toEqual(['ev-2']);
    expect(refreshed.version).toBe(summary.version + 1);
  });
});
