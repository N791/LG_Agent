import request from '../utils/request';

export interface FunnelStat {
  stage: number;
  taskName: string;
  passedCount: number;
  dropOff: number;
  conversionRate: string;
}

export interface BottleneckStat {
  taskId: string;
  taskName: string;
  totalSubmissions: number;
  failedSubmissions: number;
  failRate: string;
}

export interface PerformanceStat {
  averageCompletionTimeDays: number;
  overallPassRate: string;
  activeTrainees: number;
}

export const analyticsServiceApi = {
  getFunnel: async (courseId?: string) => {
    const res = await request.get<unknown, FunnelStat[]>('/analytics/funnel', {
      params: { courseId },
    });
    return res;
  },

  getBottlenecks: async (courseId?: string) => {
    const res = await request.get<unknown, BottleneckStat[]>('/analytics/bottlenecks', {
      params: { courseId },
    });
    return res;
  },

  getPerformance: async (courseId?: string) => {
    const res = await request.get<unknown, PerformanceStat>('/analytics/performance', {
      params: { courseId },
    });
    return res;
  },
};
