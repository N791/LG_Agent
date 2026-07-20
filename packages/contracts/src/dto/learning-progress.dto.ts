export interface CourseProgressDTO {
  courseId: string;
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  currentStage: number;
  status: string;
  statistics: {
    successRate: number;
    totalSubmissions: number;
    aiUsage: number; // For now, could just be a count of how many ai reviews they triggered, or 0
    activeDays: number;
  };
}

export interface TimelineNodeDTO {
  taskId: string;
  title: string;
  stage: number;
  status: 'LOCKED' | 'AVAILABLE' | 'PASSED';
}
