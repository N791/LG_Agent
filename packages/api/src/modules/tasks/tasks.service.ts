import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, Task } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(courseId?: string): Promise<Task[]> {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }
    return this.prisma.task.findMany({
      where: { courseId },
      orderBy: { stage: 'asc' },
    });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async create(data: Prisma.TaskUncheckedCreateInput): Promise<Task> {
    return this.prisma.task.create({ data });
  }

  async update(id: string, data: Prisma.TaskUncheckedUpdateInput): Promise<Task> {
    await this.findOne(id);
    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Task> {
    await this.findOne(id);
    return this.prisma.task.delete({ where: { id } });
  }
}
