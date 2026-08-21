import type { SubmissionStatus } from './submission.dto';

/** Increment when a mobile read-model field changes incompatibly. */
export const MOBILE_READ_MODEL_VERSION = 1 as const;

export enum MobileTaskStage {
  ENVIRONMENT_DISCOVERY = 'ENVIRONMENT_DISCOVERY',
  KNOWLEDGE_DELIVERY = 'KNOWLEDGE_DELIVERY',
  INTERACTIVE_QA = 'INTERACTIVE_QA',
  HANDS_ON_CODING = 'HANDS_ON_CODING',
  MICRO_TEST = 'MICRO_TEST',
  CI_ACCEPTANCE = 'CI_ACCEPTANCE',
}

export enum MobileTaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_VALIDATION = 'AWAITING_VALIDATION',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

export enum MobileNextActionType {
  READ_KNOWLEDGE = 'READ_KNOWLEDGE',
  ASK_AI = 'ASK_AI',
  CONTINUE_ON_PC = 'CONTINUE_ON_PC',
  REVIEW_FAILURE = 'REVIEW_FAILURE',
  WAIT_FOR_CI = 'WAIT_FOR_CI',
  VIEW_COMPLETION = 'VIEW_COMPLETION',
}

export interface MobileStageProgressDTO {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  stage: MobileTaskStage;
  state: 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'BLOCKED';
}

export interface MobileNextActionDTO {
  type: MobileNextActionType;
  label: string;
  requiresPc: boolean;
  taskId: string;
  submissionId?: string;
}

export interface MobileFailureActionDTO {
  id: string;
  label: string;
  kind: 'FIX' | 'ASK_AI' | 'CONTINUE_ON_PC';
  requiresPc: boolean;
}

/** Deliberately excludes raw logs, source snippets, prompts, and credentials. */
export interface MobileFailureSummaryDTO {
  conclusion: 'FAILED' | 'SYSTEM_ERROR';
  primaryCause: string;
  affectedChecks: string[];
  actions: MobileFailureActionDTO[];
  evidenceLabel?: string;
}

export interface MobileSubmissionSummaryDTO {
  readModelVersion: typeof MOBILE_READ_MODEL_VERSION;
  submissionId: string;
  taskId: string;
  status: SubmissionStatus;
  score: number;
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
  failure?: MobileFailureSummaryDTO;
}

export interface MobileKnowledgeCardSummaryDTO {
  id: string;
  title: string;
  estimatedMinutes?: number;
}

export interface MobileTaskSummaryDTO {
  id: string;
  courseId: string;
  title: string;
  summary?: string;
  status: MobileTaskStatus;
  currentStage: MobileTaskStage;
  stagePosition: 1 | 2 | 3 | 4 | 5 | 6;
  requiresPc: boolean;
  blockedReason?: string;
  nextAction: MobileNextActionDTO;
  latestSubmission?: MobileSubmissionSummaryDTO;
}

export interface MobileTaskDetailDTO extends MobileTaskSummaryDTO {
  description?: string;
  taskVersion: number;
  stages: MobileStageProgressDTO[];
  knowledgeCards: MobileKnowledgeCardSummaryDTO[];
}

export interface MobileTaskPageDTO {
  readModelVersion: typeof MOBILE_READ_MODEL_VERSION;
  items: MobileTaskSummaryDTO[];
  nextCursor?: string;
}

export interface MobileHomeDTO {
  readModelVersion: typeof MOBILE_READ_MODEL_VERSION;
  generatedAt: string;
  course?: {
    id: string;
    title: string;
    progress: number;
  };
  currentTask?: MobileTaskSummaryDTO;
  unreadNotificationCount: number;
  recentFeedback?: {
    id: string;
    type: string;
    title: string;
    createdAt: string;
  };
}

export interface MobileDeviceRegistrationRequestDTO {
  installationId: string;
  pushToken: string;
  platform: 'ANDROID';
  appVersion: string;
  locale: string;
  idempotencyKey: string;
}

export interface MobileDeviceRegistrationDTO {
  deviceId: string;
  registeredAt: string;
  duplicate: boolean;
}

export type MobileHandoffTargetType = 'TASK' | 'WORKSPACE' | 'SUBMISSION';

export interface CreateMobileHandoffRequestDTO {
  targetType: MobileHandoffTargetType;
  targetId: string;
  idempotencyKey: string;
}

export interface MobileHandoffDTO {
  handoffId: string;
  token: string;
  targetType: MobileHandoffTargetType;
  targetId: string;
  expiresAt: string;
  duplicate: boolean;
}
