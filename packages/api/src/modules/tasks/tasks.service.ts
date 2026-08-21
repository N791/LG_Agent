import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Task, Prisma } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  async findAll(courseId: string | undefined, actor: TenantActor): Promise<Task[]> {
    if (!courseId) {
      throw new BadRequestException('errors.task.courseIdRequired');
    }
    return this.prisma.task.findMany({
      where: { courseId, ...this.tenantScope.task(actor) },
      orderBy: { stage: 'asc' },
    });
  }

  async findOne(id: string, actor: TenantActor): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id, ...this.tenantScope.task(actor) },
    });
    if (!task) {
      throw new NotFoundException({ message: 'errors.task.notFound', args: { id } });
    }
    return task;
  }

  async create(data: CreateTaskDto, actor: TenantActor): Promise<Task> {
    await this.tenantScope.assertTaskCourse(data.courseId, actor);
    return this.prisma.task.create({ data: data as unknown as Prisma.TaskCreateInput });
  }

  async update(id: string, data: UpdateTaskDto, actor: TenantActor): Promise<Task> {
    await this.findOne(id, actor);
    if (data.courseId) await this.tenantScope.assertTaskCourse(data.courseId, actor);
    return this.prisma.task.update({
      where: { id },
      data: data as unknown as Prisma.TaskUpdateInput,
    });
  }

  async remove(id: string, actor: TenantActor): Promise<Task> {
    await this.findOne(id, actor);
    return this.prisma.task.delete({ where: { id } });
  }
}
