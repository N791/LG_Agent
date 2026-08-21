import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsRoot = fileURLToPath(new URL('../prisma/migrations/', import.meta.url));
// Epic 80 intentionally removed pre-existing cross-tenant assignments before
// adding its invariant. From the reconciled Epic 81 baseline onward, rollback
// compatibility requires the authorization data set to remain append-only.
const authorizationStart = '20260729020000_epic81_registry_and_audit';
const protectedTables = [
  'permissions',
  'authorization_roles',
  'role_permissions',
  'user_roles',
  'permission_registry_state',
];
const destructive = new RegExp(
  `(?:DROP\\s+TABLE|TRUNCATE(?:\\s+TABLE)?|DELETE\\s+FROM)\\s+(?:"public"\\.)?"?(?:${protectedTables.join('|')})"?\\b`,
  'i',
);

const failures = [];
for (const directory of readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name >= authorizationStart)
  .sort((left, right) => left.name.localeCompare(right.name))) {
  const sqlPath = join(migrationsRoot, directory.name, 'migration.sql');
  const sql = readFileSync(sqlPath, 'utf8').replaceAll(/--.*$/gm, '');
  if (destructive.test(sql)) failures.push(directory.name);
}

if (failures.length > 0) {
  process.stderr.write(
    `Authorization migrations must remain forward-compatible; destructive SQL found in: ${failures.join(', ')}\n`,
  );
  process.exit(1);
}
process.stdout.write('Authorization migrations are additive and rollback-safe.\n');
