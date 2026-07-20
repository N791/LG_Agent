import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DashboardStatisticsDTO, DashboardCourseDTO } from '@lg-agent/contracts';

@Injectable()
export class LearningStatisticsService {
  constructor(private prisma: PrismaService) {}

  async getOverallStatistics(userId: string): Promise<DashboardStatisticsDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true }
    });

    const allSubmissionsForStats = await this.prisma.submission.findMany({
      where: { userId },
      select: { status: true, score: true, aiReview: true, createdAt: true },
    });

    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { userId },
      select: { progress: true }
    });

    const totalSubmissions = allSubmissionsForStats.length;
    const successRate = totalSubmissions > 0 
      ? Math.round((allSubmissionsForStats.filter(s => s.status === 'PASSED').length / totalSubmissions) * 100) 
      : 0;
    
    const aiUsage = allSubmissionsForStats.filter(s => s.aiReview !== null).length;
    
    const distinctDays = new Set(allSubmissionsForStats.map(s => s.createdAt.toISOString().split('T')[0]));
    const activeDays = distinctDays.size;

    const coursesCompleted = enrollments.filter(e => e.progress === 100).length;

    return {
      activeDays,
      successRate,
      aiUsage,
      totalPoints: user?.totalPoints ?? 0,
      coursesCompleted,
    };
  }

  async getMyCourses(userId: string): Promise<DashboardCourseDTO[]> {
    const courses = await this.prisma.course.findMany({
      where: { status: 1 },
      orderBy: { createdAt: 'asc' }
    });

    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { userId }
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true }
    });
    
    const totalPoints = user?.totalPoints ?? 0;

    return courses.map(course => {
      const enrollment = enrollments.find(e => e.courseId === course.id);
      
      let status: 'LOCKED' | 'ENROLLED' | 'COMPLETED' | 'AVAILABLE' = 'AVAILABLE';
      if (enrollment) {
        if (enrollment.progress === 100) status = 'COMPLETED';
        else status = 'ENROLLED';
      } else if (course.requiredPoints > totalPoints) {
        status = 'LOCKED';
      }

      return {
        courseId: course.id,
        title: course.title,
        description: course.description ?? undefined,
        progressPercentage: enrollment?.progress ?? 0,
        currentStage: enrollment?.currentStage ?? 1,
        status,
        requiredPoints: course.requiredPoints,
      };
    });
  }
}
