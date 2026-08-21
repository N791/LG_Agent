import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, Course } from '@prisma/client';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import type {
  OrganizationScopedRepository,
  TenantActor,
} from '../../common/tenant/organization-scoped.repository';

@Injectable()
export class CoursesService implements OrganizationScopedRepository<Course> {
  constructor(
    private prisma: PrismaService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  async findAll(actor: TenantActor): Promise<Course[]> {
    return this.prisma.course.findMany({
      where: this.tenantScope.course(actor),
      include: {
        organization: true,
        createdBy: {
          select: { id: true, username: true, nickname: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findManyScoped(actor: TenantActor): Promise<Course[]> {
    return this.findAll(actor);
  }

  async findOne(id: string, actor: TenantActor): Promise<Course> {
    const course = await this.prisma.course.findFirst({
      where: { id, ...this.tenantScope.course(actor) },
      include: {
        organization: true,
        createdBy: {
          select: { id: true, username: true, nickname: true },
        },
      },
    });
    if (!course) {
      throw new NotFoundException({ message: 'errors.course.notFound', args: { id } });
    }
    return course;
  }

  findOneScoped(id: string, actor: TenantActor): Promise<Course> {
    return this.findOne(id, actor);
  }

  async create(data: Prisma.CourseUncheckedCreateInput, actor: TenantActor): Promise<Course> {
    return this.prisma.course.create({
      data: { ...data, organizationId: actor.organizationId, createdById: actor.id },
    });
  }

  async update(
    id: string,
    data: Prisma.CourseUncheckedUpdateInput,
    actor: TenantActor,
  ): Promise<Course> {
    await this.findOne(id, actor);
    const { organizationId: _organizationId, createdById: _createdById, ...safeData } = data;
    return this.prisma.course.update({
      where: { id },
      data: safeData,
    });
  }

  async remove(id: string, actor: TenantActor): Promise<Course> {
    await this.findOne(id, actor);
    return this.prisma.course.delete({ where: { id } });
  }
}
