import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma, User } from '@prisma/client';
import { LegacyRoleBridgeService } from '../authorization';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly legacyRoleBridge: LegacyRoleBridgeService,
  ) {}

  async findAll(organizationId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { organizationId },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByIdScoped(id: string, organizationId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('errors.auth.userNotFound');
    return user;
  }

  async create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      await this.legacyRoleBridge.userCreated(tx, user);
      return user;
    });
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id } });
      await this.legacyRoleBridge.prepareUserUpdate(tx, before, data);
      const user = await tx.user.update({ where: { id }, data });
      await this.legacyRoleBridge.userUpdated(tx, before, user);
      return user;
    });
  }

  async remove(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
