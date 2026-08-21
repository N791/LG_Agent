import { Injectable } from '@nestjs/common';
import {
  DisclosureLevelDTO,
  RetrievalRouteDTO,
  type RouteQueryInputDTO,
  type RouteQueryResultDTO,
} from '@lg-agent/contracts';
import type { IQueryRouter } from './interfaces';

export const QUERY_ROUTER_POLICY_VERSION = 'query-router.v1';

const CODE_PATTERN =
  /(?:\b(?:class|function|method|symbol|call|import|stack|trace|compile|typescript|javascript|python)\b|\u4ee3\u7801|\u51fd\u6570|\u7c7b|\u8c03\u7528|\u7f16\u8bd1|\u62a5\u9519)/i;
const DOCUMENT_PATTERN =
  /(?:\b(?:document|guide|policy|requirement|manual|spec|chapter|page)\b|\u6587\u6863|\u6307\u5357|\u89c4\u8303|\u624b\u518c|\u9700\u6c42|\u7ae0\u8282)/i;
const TASK_PATTERN =
  /(?:\b(?:task|stage|progress|deadline|acceptance|todo)\b|\u4efb\u52a1|\u9636\u6bb5|\u8fdb\u5ea6|\u9a8c\u6536|\u5f85\u529e)/i;
const CONVERSATION_PATTERN =
  /(?:\b(?:previous|earlier|you said|we decided|conversation)\b|\u4e0a\u6b21|\u4e4b\u524d|\u4f60\u8bf4|\u6211\u4eec\u51b3\u5b9a|\u5bf9\u8bdd)/i;

@Injectable()
export class QueryRouterService implements IQueryRouter {
  route(input: RouteQueryInputDTO): Promise<RouteQueryResultDTO> {
    const rewrittenQuery = this.rewriteQuery(input);
    if (input.preferredRoute) {
      const routes =
        input.preferredRoute === RetrievalRouteDTO.MIXED
          ? [RetrievalRouteDTO.DOCUMENT, RetrievalRouteDTO.CODE]
          : [input.preferredRoute];
      return Promise.resolve(
        this.result(input.preferredRoute, routes, 1, ['caller-preference'], {
          ...input,
          query: rewrittenQuery,
        }),
      );
    }

    const signals = [input.query, input.errorLog, input.selection?.content, input.activeFile?.path]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const reasons: string[] = [];
    const routes: RetrievalRouteDTO[] = [];
    const hasCode =
      CODE_PATTERN.test(signals) ||
      Boolean(input.activeFile) ||
      Boolean(input.selection) ||
      input.tutorAction === 'code-review' ||
      input.tutorAction === 'explain-error' ||
      input.tutorAction === 'refactor';
    const hasDocument = DOCUMENT_PATTERN.test(signals);
    const hasTask =
      TASK_PATTERN.test(signals) || Boolean(input.taskState) || Boolean(input.taskStage);
    const hasConversation =
      CONVERSATION_PATTERN.test(signals) ||
      Boolean(input.recentConversation) ||
      input.tutorAction === 'follow-up';

    if (hasDocument) {
      routes.push(RetrievalRouteDTO.DOCUMENT);
      reasons.push('document-signal');
    }
    if (hasCode) {
      routes.push(RetrievalRouteDTO.CODE);
      reasons.push('code-context-signal');
    }
    if (hasTask) {
      routes.push(RetrievalRouteDTO.TASK_STATE);
      reasons.push('task-state-signal');
    }
    if (hasConversation) {
      routes.push(RetrievalRouteDTO.CONVERSATION);
      reasons.push('conversation-signal');
    }

    if (routes.length === 0) {
      routes.push(RetrievalRouteDTO.DOCUMENT, RetrievalRouteDTO.CODE);
      reasons.push('low-confidence-bounded-mixed-fallback');
    }

    const searchRoutes = routes.filter(
      (route) => route === RetrievalRouteDTO.DOCUMENT || route === RetrievalRouteDTO.CODE,
    );
    const primaryRoute =
      searchRoutes.length > 1 || routes.length > 1
        ? RetrievalRouteDTO.MIXED
        : (routes[0] ?? RetrievalRouteDTO.MIXED);
    const confidence =
      reasons[0] === 'low-confidence-bounded-mixed-fallback'
        ? 0.35
        : Math.min(0.95, 0.68 + reasons.length * 0.09);

    return Promise.resolve(
      this.result(primaryRoute, routes, confidence, reasons, {
        ...input,
        query: rewrittenQuery,
      }),
    );
  }

  private result(
    route: RetrievalRouteDTO,
    routes: RetrievalRouteDTO[],
    confidence: number,
    reasons: string[],
    input: RouteQueryInputDTO,
  ): RouteQueryResultDTO {
    const lowConfidenceFallback = confidence < 0.5;
    const candidateLimit = lowConfidenceFallback ? 3 : route === RetrievalRouteDTO.MIXED ? 8 : 5;
    return {
      route,
      confidence,
      reasons,
      policyVersion: QUERY_ROUTER_POLICY_VERSION,
      plan: {
        primaryRoute: route,
        routes,
        rewrittenQuery: input.query,
        filters: input.filters ?? {},
        candidateLimit,
        targetDisclosureLevel: DisclosureLevelDTO.L0,
        suggestedEvidenceTokens: lowConfidenceFallback ? 900 : 1_600,
        lowConfidenceFallback,
      },
    };
  }

  private rewriteQuery(input: RouteQueryInputDTO): string {
    const context = [
      input.query.trim(),
      input.activeFile?.path ? `active-file:${input.activeFile.path}` : '',
      input.taskStage ? `task-stage:${input.taskStage}` : '',
      input.errorLog ? `error:${input.errorLog.slice(0, 500)}` : '',
    ].filter(Boolean);
    return context.join(' ');
  }
}
