import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, Organization } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return org;
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Organization> {
    await this.findOne(id);
    return this.prisma.organization.delete({ where: { id } });
  }
}
