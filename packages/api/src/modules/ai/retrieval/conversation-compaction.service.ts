import { Injectable } from '@nestjs/common';
import type { ConversationSummaryDTO } from '@lg-agent/contracts';
import { PrismaService } from '../../../common/prisma.service';
import { ConversationCompactorService } from './conversation-compactor.service';

@Injectable()
export class ConversationCompactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compactor: ConversationCompactorService,
  ) {}

  async compactConversation(input: {
    organizationId: string;
    userId: string;
    conversationId: string;
    keepRecentTurns?: number;
    conflictingEvidenceIds?: string[];
  }): Promise<ConversationSummaryDTO | undefined> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        organizationId: input.organizationId,
        userId: input.userId,
      },
      include: {
        messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        summaries: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!conversation || conversation.messages.length === 0) return undefined;

    const latest = conversation.summaries[0];
    const previous = this.readStructuredSummary(latest?.metadata);
    const summary = this.compactor.compact({
      organizationId: input.organizationId,
      userId: input.userId,
      conversationId: input.conversationId,
      keepRecentTurns: input.keepRecentTurns,
      conflictingEvidenceIds: input.conflictingEvidenceIds,
      previousSummary: previous,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role as 'system' | 'user' | 'assistant',
        content: message.content,
        evidenceIds: this.readEvidenceIds(message.metadata),
      })),
    });

    // The insert is the commit point. Source messages are intentionally retained; a
    // lifecycle job may purge them only after observing this durable summary version.
    await this.prisma.conversationSummary.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        version: (latest?.version ?? 0) + 1,
        throughMessageId: summary.throughMessageId,
        content: summary.content,
        tokenCount: Math.ceil(summary.content.length / 4),
        metadata: JSON.parse(JSON.stringify({ structured: summary })) as object,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000),
      },
    });
    return summary;
  }

  private readStructuredSummary(metadata: unknown): ConversationSummaryDTO | undefined {
    if (!metadata || typeof metadata !== 'object' || !('structured' in metadata)) return undefined;
    const structured = metadata.structured;
    if (!structured || typeof structured !== 'object') return undefined;
    if (!('version' in structured) || !('throughMessageId' in structured)) return undefined;
    return structured as ConversationSummaryDTO;
  }

  private readEvidenceIds(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object' || !('evidenceIds' in metadata)) return [];
    const evidenceIds = metadata.evidenceIds;
    return Array.isArray(evidenceIds)
      ? evidenceIds.filter((value): value is string => typeof value === 'string')
      : [];
  }
}
