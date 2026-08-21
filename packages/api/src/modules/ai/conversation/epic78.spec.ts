import {
  DisclosureLevelDTO,
  RetrievalRouteDTO,
  type ContextEnvelopeDTO,
  type RetrievalToolResultDTO,
} from '@lg-agent/contracts';
import { PromptAssemblyPipeline } from './prompt-assembly.pipeline';
import { AiConversationService } from './ai-conversation.service';

const budget = {
  total: 4_000,
  systemPolicy: 400,
  taskState: 400,
  recentConversation: 600,
  documents: 600,
  code: 600,
  toolResults: 200,
  modelOutput: 1_200,
  usedEvidence: 120,
  truncated: false,
};

const context: ContextEnvelopeDTO = {
  organizationId: 'organization-a',
  route: RetrievalRouteDTO.CODE,
  policyVersion: 'query-router.v1',
  evidence: [
    {
      id: 'evidence-a',
      organizationId: 'organization-a',
      route: RetrievalRouteDTO.CODE,
      disclosureLevel: DisclosureLevelDTO.L1,
      content: 'export function validate() {}',
      score: 0.91,
      citation: {
        id: 'citation-a',
        organizationId: 'organization-a',
        title: 'validator.ts',
        uri: 'repo://validator.ts#validate',
        repositorySnapshotId: 'snapshot-a',
        symbolId: 'symbol-a',
        revision: 'abcdef123456',
        locator: {
          path: 'src/validator.ts',
          symbol: 'validate',
          startLine: 10,
          endLine: 12,
        },
      },
    },
  ],
  citations: [],
  budget,
  disclosureUpgrades: [],
};
context.citations = context.evidence.map(({ citation }) => citation);

describe('Epic 78 tutor retrieval integration', () => {
  it('assembles prompts from ContextEnvelope without a workspace dump', async () => {
    const promptBuilder = {
      assembleMessages: jest.fn().mockResolvedValue([
        { role: 'system', content: 'system' },
        { role: 'user', content: 'question' },
      ]),
    };
    const pipeline = new PromptAssemblyPipeline(promptBuilder as never);

    await pipeline.assemble(
      { action: 'code-review', taskId: 'task-a', content: 'review this' },
      [],
      context,
    );

    const [, variables] = promptBuilder.assembleMessages.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(variables).not.toHaveProperty('workspace');
    expect(variables).not.toHaveProperty('activeFileContext');
    const serializedEnvelope = variables['contextEnvelope'];
    expect(serializedEnvelope).toBeDefined();
    expect(JSON.parse(serializedEnvelope ?? '{}')).toMatchObject({
      route: RetrievalRouteDTO.CODE,
      evidence: [
        {
          evidenceId: 'evidence-a',
          citationId: 'citation-a',
          locator: { symbol: 'validate' },
        },
      ],
    });
  });

  it('routes action signals once and returns answer, citations and traceSummary', async () => {
    const retrieval: RetrievalToolResultDTO = {
      evidence: context.evidence,
      context,
      trace: {
        traceId: 'trace-a',
        organizationId: 'organization-a',
        route: RetrievalRouteDTO.CODE,
        disclosureLevel: DisclosureLevelDTO.L1,
        evidenceCount: 1,
        totalCandidates: 2,
        durationMs: 4,
        cacheHit: false,
        shadowRead: false,
        createdAt: new Date().toISOString(),
        tokenBudget: budget,
      },
    };
    const prisma = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-a',
          userId: 'user-a',
          taskId: 'task-a',
          organizationId: 'organization-a',
        }),
      },
      conversationMessage: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const pipeline = { assemble: jest.fn().mockResolvedValue([{ role: 'user', content: 'x' }]) };
    const gateway = {
      chat: jest.fn().mockResolvedValue({
        content: 'Use validate [1].',
        model: 'mock',
        provider: 'mock',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      }),
    };
    const tenantScope = { assertTask: jest.fn().mockResolvedValue(undefined) };
    const orchestrator = { retrieve: jest.fn().mockResolvedValue(retrieval) };
    const service = new AiConversationService(
      prisma as never,
      pipeline as never,
      gateway as never,
      tenantScope as never,
      orchestrator,
    );

    const result = await service.chat({
      action: 'code-review',
      taskId: 'task-a',
      content: 'review this',
      activeFile: 'src/validator.ts',
      repositorySnapshotId: 'snapshot-a',
      selection: { content: 'validate()', startLine: 10, endLine: 10 },
      submissionLog: 'test failed',
      workspaceVersionId: 'workspace-version-a',
      userId: 'user-a',
      organizationId: 'organization-a',
    });

    expect(orchestrator.retrieve).toHaveBeenCalledTimes(1);
    expect(orchestrator.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        tutorAction: 'code-review',
        activeFile: {
          path: 'src/validator.ts',
          repositorySnapshotId: 'snapshot-a',
        },
        selection: { content: 'validate()', startLine: 10, endLine: 10 },
        errorLog: 'test failed',
        sourceVersions: ['workspace-version-a', 'snapshot-a'],
        disclosureLevel: DisclosureLevelDTO.L2,
      }),
    );
    expect(result).toMatchObject({
      answer: 'Use validate [1].',
      citations: [{ id: 'citation-a' }],
      traceSummary: { traceId: 'trace-a' },
      evidenceSupport: 'SUPPORTED',
      degraded: false,
    });
  });
});
