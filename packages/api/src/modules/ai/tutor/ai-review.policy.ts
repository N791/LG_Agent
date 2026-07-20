export interface IAIReviewPolicy {
  shouldGenerateReview(submissionStatus: string, logs: string | null, score: number): boolean;
}

export class AutoAIReviewPolicy implements IAIReviewPolicy {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldGenerateReview(submissionStatus: string, _logs: string | null, _score: number): boolean {
    // For MVP: Auto-generate review if the task failed or errored.
    return submissionStatus === 'FAILED' || submissionStatus === 'ERROR';
  }
}
