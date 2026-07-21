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
    const res = await request.get<unknown, OverviewStats>('/statistics/overview');
    return res;
  },

  getLearningTrends: async () => {
    const res = await request.get<unknown, LearningTrend[]>('/statistics/trends');
    return res;
  },

  getBlockers: async () => {
    const res = await request.get<unknown, BlockerStat[]>('/statistics/blockers');
    return res;
  },

  getAiUsage: async () => {
    const res = await request.get<unknown, AiUsageStat[]>('/statistics/ai-usage');
    return res;
  },

  getAiAudit: async () => {
    const res = await request.get<unknown, AiAuditStat[]>('/statistics/ai-audit');
    return res;
  },
};
