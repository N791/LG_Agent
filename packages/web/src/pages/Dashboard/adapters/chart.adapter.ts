import { AiUsageStat, LearningTrend } from '../../../services/statistics';

export class ChartAdapter {
  static toLearningTrendsChart(trends: LearningTrend[]) {
    return trends.map(t => ({
      name: t.date,
      Passed: t.passed,
      Failed: t.failed,
    }));
  }

  static toAiUsageChart(usage: AiUsageStat[]) {
    return usage.map(u => ({
      name: u.model,
      Tokens: u.totalTokens,
      Cost: u.totalCost,
      Requests: u.totalRequests,
    }));
  }
}
