import { PERMISSION_REGISTRY_VERSION } from '@lg-agent/contracts';
import { PrismaClient } from '@prisma/client';
import {
  AUTHORIZATION_REGISTRY_STATE_ID,
  authorizationRegistryDigest,
} from '../modules/authorization/authorization-registry.service';

const requiredAuthorizationTables = [
  'permissions',
  'authorization_roles',
  'role_permissions',
  'user_roles',
] as const;

async function assertTables(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const present = new Set(rows.map(({ table_name }) => table_name));
  const required = ['_prisma_migrations', ...requiredAuthorizationTables];
  const missing = required.filter((table) => !present.has(table));
  if (missing.length > 0)
    throw new Error(`Required deployment tables are missing: ${missing.join(', ')}`);

  const migrationRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  `;
  if ((migrationRows[0]?.count ?? 0n) === 0n) {
    throw new Error('No successfully applied Prisma migrations were found');
  }
}

async function assertRegistry(prisma: PrismaClient): Promise<void> {
  const state = await prisma.permissionRegistryState.findUnique({
    where: { id: AUTHORIZATION_REGISTRY_STATE_ID },
  });
  if (
    state?.registryVersion !== PERMISSION_REGISTRY_VERSION ||
    state.registryDigest !== authorizationRegistryDigest()
  ) {
    throw new Error(
      `Permission registry mismatch: expected version ${String(PERMISSION_REGISTRY_VERSION)}, got ${String(state?.registryVersion ?? null)}`,
    );
  }
}

export async function verifyDeploymentDatabase(mode: string): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$connect();
  try {
    await assertTables(prisma);
    if (mode === 'registry') await assertRegistry(prisma);
    if (mode !== 'migrations' && mode !== 'registry') {
      throw new Error(`Unknown verification mode ${mode}`);
    }
    process.stdout.write(`Database deployment verification passed (${mode}).\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void verifyDeploymentDatabase(process.argv[2] ?? '').catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
