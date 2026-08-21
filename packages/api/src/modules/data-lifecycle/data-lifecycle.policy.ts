import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DataLifecyclePolicy {
  enabled: boolean;
  batchSize: number;
  workspaceVersionMaxCount: number;
  workspaceVersionRetentionDays: number;
  conversationRetentionDays: number;
  llmRequestRetentionDays: number;
  llmAuditRetentionDays: number;
  auditEventRetentionDays: number;
  clientLogRetentionDays: number;
  clientMetricRetentionDays: number;
  submissionArchiveThresholdBytes: number;
}

@Injectable()
export class DataLifecyclePolicyProvider {
  constructor(private readonly config: ConfigService) {}

  get policy(): DataLifecyclePolicy {
    return {
      enabled: this.config.get<boolean>('DATA_LIFECYCLE_ENABLED', true),
      batchSize: this.config.get<number>('DATA_LIFECYCLE_BATCH_SIZE', 1_000),
      workspaceVersionMaxCount: this.config.get<number>('WORKSPACE_VERSION_MAX_COUNT', 50),
      workspaceVersionRetentionDays: this.config.get<number>(
        'WORKSPACE_VERSION_RETENTION_DAYS',
        90,
      ),
      conversationRetentionDays: this.config.get<number>('CONVERSATION_RETENTION_DAYS', 365),
      llmRequestRetentionDays: this.config.get<number>('LLM_REQUEST_RETENTION_DAYS', 180),
      llmAuditRetentionDays: this.config.get<number>('LLM_AUDIT_RETENTION_DAYS', 365),
      auditEventRetentionDays: this.config.get<number>('AUDIT_EVENT_RETENTION_DAYS', 2_555),
      clientLogRetentionDays: this.config.get<number>('CLIENT_LOG_RETENTION_DAYS', 30),
      clientMetricRetentionDays: this.config.get<number>('CLIENT_METRIC_RETENTION_DAYS', 90),
      submissionArchiveThresholdBytes: this.config.get<number>(
        'SUBMISSION_ARCHIVE_THRESHOLD_BYTES',
        262_144,
      ),
    };
  }
}
