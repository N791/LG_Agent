import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const username = process.env['BOOTSTRAP_ADMIN_USERNAME'];
  const password = process.env['BOOTSTRAP_ADMIN_PASSWORD'];
  const organizationCode = process.env['BOOTSTRAP_ORGANIZATION_CODE'];
  const organizationName = process.env['BOOTSTRAP_ORGANIZATION_NAME'];

  if (!username || !password || !organizationCode || !organizationName) {
    throw new Error(
      'BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ORGANIZATION_CODE and BOOTSTRAP_ORGANIZATION_NAME are required.',
    );
  }
  if (password.length < 14) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 14 characters.');
  }
  const mustChangePassword = process.env['NODE_ENV'] === 'production';

  const outcome = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { code: organizationCode },
      update: { name: organizationName },
      create: { code: organizationCode, name: organizationName },
    });
    const existing = await tx.user.findUnique({ where: { username } });
    if (
      existing &&
      (existing.organizationId !== organization.id ||
        existing.role !== 'ADMIN' ||
        existing.status !== 1)
    ) {
      throw new Error(
        `Bootstrap refused: existing user "${username}" is not an active administrator in organization "${organizationCode}".`,
      );
    }
    if (existing && !(await bcrypt.compare(password, existing.password))) {
      throw new Error(
        `Bootstrap refused: configured password does not match existing user "${username}". Passwords are never reset implicitly.`,
      );
    }

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { mustChangePassword, legacyRoleMigratedAt: new Date() },
        })
      : await tx.user.create({
          data: {
            username,
            password: await bcrypt.hash(password, 12),
            nickname: 'Bootstrap Administrator',
            role: 'ADMIN',
            organizationId: organization.id,
            mustChangePassword,
            legacyRoleMigratedAt: new Date(),
          },
        });

    for (const roleKey of [
      'ADMIN',
      ...(process.env['BOOTSTRAP_PLATFORM_ADMIN'] === 'true' ? ['PLATFORM_ADMIN'] : []),
    ]) {
      const role = await tx.authorizationRole.findFirstOrThrow({
        where: { key: roleKey, organizationId: null, isSystem: true },
        select: { id: true },
      });
      await tx.userRole.upsert({
        where: {
          userId_roleId_organizationId: {
            userId: user.id,
            roleId: role.id,
            organizationId: organization.id,
          },
        },
        create: {
          userId: user.id,
          roleId: role.id,
          organizationId: organization.id,
        },
        update: {},
      });
    }

    return existing ? 'reconciled' : 'created';
  });

  console.log(
    `Administrator "${username}" ${outcome}; password change ${mustChangePassword ? 'is required' : 'is not required in development'}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
