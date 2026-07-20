import request from '../utils/request';
import { CourseProgressDTO, TimelineNodeDTO, DashboardCourseDTO, DashboardStatisticsDTO } from '@lg-agent/contracts';

export interface RecentLearning {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  courseId: string;
  lastAccessTime: string;
}

class TrainingService {
  async getProgress(courseId?: string): Promise<CourseProgressDTO> {
    const url = courseId ? `/training/progress?courseId=${courseId}` : '/training/progress';
    const response = await request.get<CourseProgressDTO>(url);
    const data = (response as unknown as { data?: CourseProgressDTO })?.data ?? response;
    return data as CourseProgressDTO;
  }

  async getTimeline(courseId: string): Promise<TimelineNodeDTO[]> {
    const response = await request.get<TimelineNodeDTO[]>(`/training/timeline/${courseId}`);
    const data = (response as unknown as { data?: TimelineNodeDTO[] })?.data ?? response;
    return data as TimelineNodeDTO[];
  }

  async getRecentLearning(): Promise<RecentLearning | null> {
    const response = await request.get<RecentLearning | null>('/training/recent');
    const data = (response as unknown as { data?: RecentLearning | null })?.data ?? response;
    return data as RecentLearning;
  }

  async getMyCourses(): Promise<DashboardCourseDTO[]> {
    const response = await request.get<DashboardCourseDTO[]>('/training/my-courses');
    const data = (response as unknown as { data?: DashboardCourseDTO[] })?.data ?? response;
    return data as DashboardCourseDTO[];
  }

  async getOverallStatistics(): Promise<DashboardStatisticsDTO> {
    const response = await request.get<DashboardStatisticsDTO>('/training/statistics/me');
    const data = (response as unknown as { data?: DashboardStatisticsDTO })?.data ?? response;
    return data as DashboardStatisticsDTO;
  }
}

export const trainingService = new TrainingService();
