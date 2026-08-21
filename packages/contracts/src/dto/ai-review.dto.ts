export interface QuickFixDTO {
  strategy: 'FULL_FILE' | 'PATCH';
  files: {
    path: string;
    content: string; // The replacement content or patch string
  }[];
}

export interface AiReviewError {
  file: string;
  line?: number;
  message: string;
  fix?: QuickFixDTO;
}

export type AiReviewSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AiReviewFindingDTO {
  title: string;
  severity: AiReviewSeverity;
  file?: string;
  line?: number;
  evidence: string;
  suggestion: string;
}

export interface AiReviewRetrievalStateDTO {
  status: 'SUPPORTED' | 'DEGRADED' | 'UNAVAILABLE';
  citations: string[];
  note?: string;
}

export interface AiReviewDTO {
  summary: string;
  suggestions: string[];
  errors: AiReviewError[];
  findings?: AiReviewFindingDTO[];
  retrievalState?: AiReviewRetrievalStateDTO;
}
