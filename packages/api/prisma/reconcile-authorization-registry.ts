import { PrismaService } from '../src/common/prisma.service';
import { AuthorizationRegistryService } from '../src/modules/authorization/authorization-registry.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const registry = new AuthorizationRegistryService(prisma);
    const status = await registry.reconcile(
      process.env['RELEASE_VERSION'] ?? process.env['npm_package_version'] ?? 'development',
    );
    process.stdout.write(`${JSON.stringify(status)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
