import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, Course } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId?: string): Promise<Course[]> {
    return this.prisma.course.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true,
        createdBy: {
          select: { id: true, username: true, nickname: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        organization: true,
        createdBy: {
          select: { id: true, username: true, nickname: true },
        },
      },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    return course;
  }

  async create(data: Prisma.CourseUncheckedCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  async update(id: string, data: Prisma.CourseUncheckedUpdateInput): Promise<Course> {
    await this.findOne(id);
    return this.prisma.course.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Course> {
    await this.findOne(id);
    return this.prisma.course.delete({ where: { id } });
  }
}
