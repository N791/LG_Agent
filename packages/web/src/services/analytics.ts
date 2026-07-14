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
    const { data } = await request.get<FunnelStat[]>('/analytics/funnel', { params: { courseId } });
    return data;
  },

  getBottlenecks: async (courseId?: string) => {
    const { data } = await request.get<BottleneckStat[]>('/analytics/bottlenecks', {
      params: { courseId },
    });
    return data;
  },

  getPerformance: async (courseId?: string) => {
    const { data } = await request.get<PerformanceStat>('/analytics/performance', {
      params: { courseId },
    });
    return data;
  },
};
