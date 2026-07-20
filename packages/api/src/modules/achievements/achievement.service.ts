import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TaskDifficulty, NotificationType, NotificationPriority } from '@lg-agent/contracts';
import { DefaultScoringPolicy, IScoringPolicy } from './scoring.policy';
import { 
  IBadgeEvaluator, 
  FirstBloodBadgeEvaluator, 
  CourseCompleterBadgeEvaluator, 
  QuickLearnerBadgeEvaluator 
} from './badge.evaluator';
import type { INotificationPublisher } from '../notifications/notification-publisher.interface';
import { NOTIFICATION_PUBLISHER } from '../notifications/notification-publisher.interface';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);
  private scoringPolicy: IScoringPolicy = new DefaultScoringPolicy();
  private badgeEvaluators: IBadgeEvaluator[] = [
    new FirstBloodBadgeEvaluator(),
    new CourseCompleterBadgeEvaluator(),
    new QuickLearnerBadgeEvaluator()
  ];

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(NOTIFICATION_PUBLISHER) private readonly notificationPublisher?: INotificationPublisher,
  ) {}

  async checkAndAward(userId: string, taskId: string): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({ where: { id: taskId } });
      if (!task) return;

      // 1. Check Points (only on first pass of this specific task)
      const passedCount = await this.prisma.submission.count({
        where: { userId, taskId, status: 'PASSED' },
      });

      if (passedCount === 1) {
        const points = this.scoringPolicy.calculatePoints(task.difficulty as TaskDifficulty);
        if (points > 0) {
          const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { totalPoints: { increment: points } },
          });
          this.logger.log(`Awarded ${points} points to user ${userId} for task ${taskId}`);

          // Check if any courses have been unlocked
          await this.checkCourseUnlocks(userId, updatedUser.totalPoints);
        }
      }

      // 2. Evaluate Badges
      const earnedBadges = await this.prisma.userBadge.findMany({
        where: { userId },
        select: { badgeCode: true },
      });
      const earnedBadgeCodes = new Set(earnedBadges.map(b => b.badgeCode));

      const context = { userId, task };

      for (const evaluator of this.badgeEvaluators) {
        // Skip if already earned
        if (earnedBadgeCodes.has(evaluator.badgeCode)) continue;

        const isEarned = await evaluator.evaluate(context, this.prisma);
        if (isEarned) {
          await this.prisma.userBadge.create({
            data: {
              userId,
              badgeCode: evaluator.badgeCode,
            },
          });
          this.logger.log(`Awarded badge ${evaluator.badgeCode} to user ${userId}`);

          // Publish BADGE_AWARDED notification
          if (this.notificationPublisher) {
            await this.notificationPublisher.publish({
              userId,
              type: NotificationType.BADGE_AWARDED,
              priority: NotificationPriority.NORMAL,
              title: 'Badge Earned!',
              message: `You earned the "${evaluator.badgeCode}" badge. Congratulations!`,
              payload: { badgeCode: evaluator.badgeCode, taskId },
            });
          }
        }
      }

    } catch (error) {
      this.logger.error(`Error in checkAndAward for user ${userId}, task ${taskId}:`, error);
    }
  }

  private async checkCourseUnlocks(userId: string, totalPoints: number): Promise<void> {
    try {
      // Find courses that are now unlockable but not yet enrolled
      const lockedCourses = await this.prisma.course.findMany({
        where: {
          requiredPoints: { gt: 0, lte: totalPoints },
          status: 1,
        },
      });

      for (const course of lockedCourses) {
        const existingEnrollment = await this.prisma.courseEnrollment.findUnique({
          where: { userId_courseId: { userId, courseId: course.id } },
        });
        if (!existingEnrollment && this.notificationPublisher) {
          await this.notificationPublisher.publish({
            userId,
            type: NotificationType.COURSE_UNLOCKED,
            priority: NotificationPriority.HIGH,
            title: 'Course Unlocked!',
            message: `"${course.title}" is now available. You have enough points to start learning!`,
            payload: { courseId: course.id, courseTitle: course.title },
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error checking course unlocks for user ${userId}:`, error);
    }
  }

  async getUserAchievements(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userBadges: true },
    });

    if (!user) throw new Error('User not found');

    return {
      totalPoints: user.totalPoints,
      badges: user.userBadges.map(b => ({
        badgeCode: b.badgeCode,
        awardedAt: b.awardedAt.toISOString(),
      })),
    };
  }
}

