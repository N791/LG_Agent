import { PrismaService } from '../common/prisma.service';
import { AuthorizationRegistryService } from '../modules/authorization/authorization-registry.service';

export async function reconcileAuthorizationRegistry(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const registry = new AuthorizationRegistryService(prisma);
    const status = await registry.reconcile(process.env['RELEASE_VERSION'] ?? 'unknown-release');
    if (!status.ready)
      throw new Error(`Permission registry is not ready: ${JSON.stringify(status)}`);
    process.stdout.write(`${JSON.stringify(status)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void reconcileAuthorizationRegistry().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
