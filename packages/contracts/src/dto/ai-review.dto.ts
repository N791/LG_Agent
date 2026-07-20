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

export interface AiReviewDTO {
  summary: string;
  suggestions: string[];
  errors: AiReviewError[];
}
