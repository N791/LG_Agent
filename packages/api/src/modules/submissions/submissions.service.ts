import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { userId?: string; courseId?: string; taskId?: string }) {
    const { userId, courseId, taskId } = query;
    return this.prisma.submission.findMany({
      where: {
        ...(userId && { userId }),
        ...(taskId && { taskId }),
        ...(courseId && { task: { courseId } }),
      },
      include: {
        user: { select: { id: true, username: true } },
        task: { select: { id: true, title: true, courseId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        task: { select: { id: true, title: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return submission;
  }
}
