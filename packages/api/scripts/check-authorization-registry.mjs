import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_REGISTRY,
  PERMISSION_REGISTRY_VERSION,
  SYSTEM_ROLE_REGISTRY,
} from '../../contracts/dist/index.js';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  await readFile(path.join(root, 'prisma/authorization-registry-manifest.json'), 'utf8'),
);
const canonical = {
  version: PERMISSION_REGISTRY_VERSION,
  permissions: [...PERMISSION_REGISTRY]
    .map((permission) => ({
      key: permission.key,
      scope: permission.scope,
      version: permission.version,
      description: permission.description,
      risk: permission.risk,
      replacement: permission.replacement ?? null,
    }))
    .sort((left, right) => left.key.localeCompare(right.key)),
  roles: SYSTEM_ROLE_REGISTRY.map((role) => ({
    ...role,
    permissions: [...DEFAULT_ROLE_PERMISSIONS[role.key]].sort(),
  })).sort((left, right) => left.key.localeCompare(right.key)),
};
const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
const migration = await readFile(
  path.join(root, 'prisma/migrations', manifest.compatibilityMigration, 'migration.sql'),
  'utf8',
);

const failures = [];
if (manifest.version !== PERMISSION_REGISTRY_VERSION) {
  failures.push(`manifest version ${manifest.version} != registry ${PERMISSION_REGISTRY_VERSION}`);
}
if (manifest.digest !== digest) {
  failures.push('registry content changed without updating its versioned manifest');
}
if (!migration.includes(`permission-registry-version: ${PERMISSION_REGISTRY_VERSION}`)) {
  failures.push('compatibility migration is missing the registry version marker');
}
if (!migration.includes(`permission-registry-digest: ${digest}`)) {
  failures.push('compatibility migration is missing the registry digest marker');
}
if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `Permission registry v${PERMISSION_REGISTRY_VERSION} (${digest}) has a compatibility migration.\n`,
);
