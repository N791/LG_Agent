import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';

export interface AiAuditContext {
  userId?: string;
  organizationId?: string;
  conversationId?: string;
  traceId?: string;
  promptHash?: string;
}

export interface AiRuleHit {
  id: string;
  name: string;
  action: string;
  scope: 'request' | 'response';
}

export interface AiRequestAuditRecord extends AiAuditContext {
  requestId: string;
  provider: string;
  model: string;
  requestType: 'chat' | 'stream' | 'embed';
  latency: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  status: string;
  ruleHits: AiRuleHit[];
  fallbackFrom?: string;
}

@Injectable()
export class AiAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(record: AiRequestAuditRecord): Promise<void> {
    await this.prisma.llmRequestLog.create({
      data: {
        requestId: record.requestId,
        provider: record.provider,
        model: record.model,
        requestType: record.requestType,
        latency: record.latency,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens: record.totalTokens,
        estimatedCost: record.estimatedCost,
        status: record.status,
        promptHash: record.promptHash,
        userId: record.userId,
        organizationId: record.organizationId,
        conversationId: record.conversationId,
        traceId: record.traceId,
        ruleHits: record.ruleHits as unknown as Prisma.InputJsonValue,
        fallbackFrom: record.fallbackFrom,
      },
    });

    for (const hit of record.ruleHits) {
      await this.prisma.llmAuditLog.create({
        data: {
          requestId: record.requestId,
          eventType:
            hit.scope === 'request' ? 'REQUEST_SENSITIVE_DATA' : 'RESPONSE_SAFETY_VIOLATION',
          severity: hit.scope === 'request' ? 'MEDIUM' : 'HIGH',
          action: hit.action,
          message: `Triggered rule: ${hit.name}`,
          metadata: this.sanitizeMetadata({
            ruleId: hit.id,
            ruleName: hit.name,
            organizationId: record.organizationId,
            traceId: record.traceId,
          }),
        },
      });
    }
  }

  listForOrganization(organizationId: string, limit = 100) {
    return this.prisma.llmRequestLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      select: {
        requestId: true,
        provider: true,
        model: true,
        requestType: true,
        latency: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
        status: true,
        userId: true,
        conversationId: true,
        organizationId: true,
        traceId: true,
        promptHash: true,
        ruleHits: true,
        fallbackFrom: true,
        createdAt: true,
      },
    });
  }

  sanitizeMetadata(metadata: Record<string, unknown>): Prisma.InputJsonValue {
    const redact = (value: unknown, key = ''): unknown => {
      if (/secret|password|token|authorization|api[-_]?key/i.test(key)) return '[REDACTED]';
      if (typeof value === 'string') return value.slice(0, 512);
      if (Array.isArray(value)) return value.map((item) => redact(item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
            childKey,
            redact(childValue, childKey),
          ]),
        );
      }
      return value;
    };
    return redact(metadata) as Prisma.InputJsonValue;
  }
}
