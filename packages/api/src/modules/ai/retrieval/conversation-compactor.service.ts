import { Injectable } from '@nestjs/common';
import type { ConversationCompactionInputDTO, ConversationSummaryDTO } from '@lg-agent/contracts';

@Injectable()
export class ConversationCompactorService {
  compact(input: ConversationCompactionInputDTO): ConversationSummaryDTO {
    const keepRecentTurns = Math.max(1, input.keepRecentTurns ?? 4);
    const retainCount = keepRecentTurns * 2;
    const splitAt = Math.max(0, input.messages.length - retainCount);
    const compacted = input.messages.slice(0, splitAt);
    const retainedMessages = input.messages.slice(splitAt);
    const previous =
      input.conflictingEvidenceIds?.length && input.previousSummary
        ? undefined
        : input.previousSummary;
    const nextVersion = (input.previousSummary?.version ?? 0) + 1;

    if (compacted.length === 0) {
      const boundary = retainedMessages[0]?.id ?? previous?.throughMessageId ?? '';
      return {
        version: nextVersion,
        fromMessageId: previous?.fromMessageId ?? boundary,
        throughMessageId: previous?.throughMessageId ?? boundary,
        goals: previous?.goals ?? [],
        confirmedFacts: previous?.confirmedFacts ?? [],
        decisions: previous?.decisions ?? [],
        unresolvedQuestions: previous?.unresolvedQuestions ?? [],
        evidenceIds: previous?.evidenceIds ?? [],
        retainedMessages,
        content: previous?.content ?? '',
      };
    }

    const userMessages = compacted.filter((message) => message.role === 'user');
    const assistantMessages = compacted.filter((message) => message.role === 'assistant');
    const goals = this.unique([
      ...(previous?.goals ?? []),
      ...userMessages.slice(0, 2).map((message) => message.content),
    ]);
    const confirmedFacts = this.unique([
      ...(previous?.confirmedFacts ?? []),
      ...assistantMessages
        .filter((message) => /\b(is|are|confirmed|found|确定|确认|发现)\b/i.test(message.content))
        .map((message) => message.content),
    ]);
    const decisions = this.unique([
      ...(previous?.decisions ?? []),
      ...compacted
        .filter((message) => /\b(decided|will use|agreed|决定|采用|同意)\b/i.test(message.content))
        .map((message) => message.content),
    ]);
    const unresolvedQuestions = this.unique([
      ...(previous?.unresolvedQuestions ?? []),
      ...userMessages
        .filter((message) => /[?？]\s*$/.test(message.content))
        .map((message) => message.content),
    ]);
    const evidenceIds = this.unique([
      ...(previous?.evidenceIds ?? []),
      ...compacted.flatMap((message) => message.evidenceIds ?? []),
    ]).filter((id) => !(input.conflictingEvidenceIds ?? []).includes(id));
    const content = [
      `Goals: ${goals.join(' | ')}`,
      `Confirmed facts: ${confirmedFacts.join(' | ')}`,
      `Decisions: ${decisions.join(' | ')}`,
      `Unresolved questions: ${unresolvedQuestions.join(' | ')}`,
      `Evidence IDs: ${evidenceIds.join(', ')}`,
    ].join('\n');
    const firstCompacted = compacted[0];
    const lastCompacted = compacted.at(-1);
    if (!firstCompacted || !lastCompacted) {
      throw new Error('Conversation compaction boundary is empty.');
    }

    return {
      version: nextVersion,
      fromMessageId: previous?.fromMessageId ?? firstCompacted.id,
      throughMessageId: lastCompacted.id,
      goals,
      confirmedFacts,
      decisions,
      unresolvedQuestions,
      evidenceIds,
      retainedMessages,
      content,
    };
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }
}
