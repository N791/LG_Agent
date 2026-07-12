import request from '../utils/request';

export interface OverviewStats {
  totalUsers: number;
  totalCourses: number;
  totalTasks: number;
  totalSubmissions: number;
  overallPassRate: number;
}

export interface LearningTrend {
  date: string;
  passed: number;
  failed: number;
}

export interface BlockerStat {
  taskId: string;
  taskTitle: string;
  totalAttempts: number;
  failedAttempts: number;
  failureRate: number;
}

export interface AiUsageStat {
  model: string;
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
}

export interface AiAuditStat {
  rule: string;
  triggers: number;
}

export const statisticsService = {
  getOverview: async () => {
    const { data } = await request.get<OverviewStats>('/statistics/overview');
    return data;
  },

  getLearningTrends: async () => {
    const { data } = await request.get<LearningTrend[]>('/statistics/trends');
    return data;
  },

  getBlockers: async () => {
    const { data } = await request.get<BlockerStat[]>('/statistics/blockers');
    return data;
  },

  getAiUsage: async () => {
    const { data } = await request.get<AiUsageStat[]>('/statistics/ai-usage');
    return data;
  },

  getAiAudit: async () => {
    const { data } = await request.get<AiAuditStat[]>('/statistics/ai-audit');
    return data;
  }
};
