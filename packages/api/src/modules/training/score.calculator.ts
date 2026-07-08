import { Injectable } from '@nestjs/common';

export interface EvaluationReport {
  compileScore?: number;
  testScore?: number;
  integrationScore?: number;
  lintScore?: number;
  aiReviewScore?: number;
  timeScore?: number;

  // RAW Data for UI
  compilePassed?: boolean;
  testPassed?: boolean;
  lintPassed?: boolean;
  message?: string;
  exitCode?: number;
}

export interface FinalScoreResult {
  totalScore: number;
  passed: boolean;
  details: EvaluationReport;
}

@Injectable()
export class ScoreCalculator {
  // Weight constants based on architecture doc
  private readonly WEIGHT_COMPILE = 0.2;
  private readonly WEIGHT_TEST = 0.3;
  private readonly WEIGHT_INTEGRATION = 0.2;
  private readonly WEIGHT_LINT = 0.1;
  private readonly WEIGHT_AI = 0.1;
  private readonly WEIGHT_TIME = 0.1;

  public calculate(report: EvaluationReport): FinalScoreResult {
    // For MVP placeholders:
    // If a score is undefined, we assume it's perfectly passing if it's a "mocked" system like lint/integration,
    // OR we can explicitly pass 100 for mocks from the executor. We will expect the executor to pass raw scores 0-100.

    const compile = report.compileScore ?? (report.compilePassed ? 100 : 0);
    const test = report.testScore ?? (report.testPassed ? 100 : 0);

    // Mocks for currently unimplemented runners (Epic 13 MVP)
    const integration = report.integrationScore ?? 100;
    const lint = report.lintScore ?? (report.lintPassed !== false ? 100 : 0);
    const aiReview = report.aiReviewScore ?? 100;
    const time = report.timeScore ?? 100;

    const totalScore =
      compile * this.WEIGHT_COMPILE +
      test * this.WEIGHT_TEST +
      integration * this.WEIGHT_INTEGRATION +
      lint * this.WEIGHT_LINT +
      aiReview * this.WEIGHT_AI +
      time * this.WEIGHT_TIME;

    // A simplistic pass/fail criteria: Must pass compile and test
    const passed = compile >= 100 && test >= 100;

    return {
      totalScore: Math.round(totalScore),
      passed,
      details: {
        compileScore: compile,
        testScore: test,
        integrationScore: integration,
        lintScore: lint,
        aiReviewScore: aiReview,
        timeScore: time,
        ...report,
      },
    };
  }
}
