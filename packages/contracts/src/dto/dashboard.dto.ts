export interface DashboardCourseDTO {
  courseId: string;
  title: string;
  description?: string;
  progressPercentage: number;
  currentStage: number;
  status: 'LOCKED' | 'ENROLLED' | 'COMPLETED' | 'AVAILABLE';
  requiredPoints: number;
}

export interface DashboardStatisticsDTO {
  activeDays: number;
  successRate: number;
  aiUsage: number;
  totalPoints: number;
  coursesCompleted: number;
}
