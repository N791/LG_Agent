import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiDirectory = resolve(scriptDirectory, '..');
const workspaceDirectory = resolve(apiDirectory, '../..');
const localEnvFile = resolve(apiDirectory, '.env');
const workspaceEnvFile = resolve(workspaceDirectory, '.env');
// Node applies later --env-file values over earlier files, while already exported
// environment variables keep the highest priority. Keep package-local overrides
// compatible with the Nest ConfigModule setup.
const envFiles = [workspaceEnvFile, localEnvFile].filter(existsSync);

const [tool, ...toolArgs] = process.argv.slice(2);
const toolEntryPoints = {
  prisma: resolve(apiDirectory, 'node_modules/prisma/build/index.js'),
  'ts-node': resolve(apiDirectory, 'node_modules/ts-node/dist/bin.js'),
};

if (!tool || !(tool in toolEntryPoints)) {
  process.stderr.write('Usage: node scripts/run-with-env.mjs <prisma|ts-node> [...args]\n');
  process.exit(2);
}

const envArgs = envFiles.map((envFile) => `--env-file=${envFile}`);
const requiresDatabaseUrl = tool === 'ts-node' || toolArgs[0] !== 'generate';

if (requiresDatabaseUrl) {
  const probe = spawnSync(
    process.execPath,
    [...envArgs, '-e', 'process.exit(process.env.DATABASE_URL ? 0 : 1)'],
    { env: process.env, stdio: 'ignore' },
  );
  if (probe.status !== 0) {
    process.stderr.write(
      `DATABASE_URL is not configured. Copy ${workspaceEnvFile} from .env.example ` +
        'or export DATABASE_URL before running this command.\n',
    );
    process.exit(1);
  }
}

const nodeArgs = [...envArgs, toolEntryPoints[tool], ...toolArgs];

const result = spawnSync(process.execPath, nodeArgs, {
  cwd: apiDirectory,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`Unable to start ${tool}: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
