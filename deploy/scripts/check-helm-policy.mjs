import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [renderedPath, productionValuesPath] = process.argv.slice(2);
if (!renderedPath || !productionValuesPath) {
  throw new Error('Usage: node check-helm-policy.mjs <rendered.yaml> <production-values.yaml>');
}

function readRendered(path) {
  if (!statSync(path).isDirectory()) return readFileSync(path, 'utf8');
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) return [readRendered(child)];
      return /\.ya?ml$/i.test(entry.name) ? [readFileSync(child, 'utf8')] : [];
    })
    .join('\n---\n');
}

const rendered = readRendered(renderedPath);
const productionValues = readFileSync(productionValuesPath, 'utf8');
const failures = [];

function requireMatch(pattern, message) {
  if (!pattern.test(rendered)) failures.push(message);
}

for (const component of ['api', 'admin-web', 'trainee-web']) {
  requireMatch(
    new RegExp(`kind: Deployment[\\s\\S]*?app\\.kubernetes\\.io/component: ${component}`),
    `missing ${component} Deployment`,
  );
  requireMatch(
    new RegExp(`app\\.kubernetes\\.io/component: ${component}[\\s\\S]*?resources:\\s*\\n\\s+limits:[\\s\\S]*?requests:`),
    `${component} must define resource limits and requests`,
  );
}

requireMatch(/path: \/api\/v1\/health(?:\s|$)/, 'API liveness probe must use /api/v1/health');
requireMatch(
  /path: \/api\/v1\/health\/ready(?:\s|$)/,
  'API readiness probe must use /api/v1/health/ready',
);
requireMatch(/helm\.sh\/hook: pre-install,pre-upgrade/, 'migration must be a Helm pre-install/pre-upgrade hook');
requireMatch(/prisma\/build\/index\.js migrate status/, 'migration hook must run prisma migrate status');
requireMatch(/prisma\/build\/index\.js migrate deploy/, 'migration hook must run prisma migrate deploy');
requireMatch(/reconcile-authorization\.js/, 'migration hook must reconcile the authorization registry');
requireMatch(/secretRef:\s*\n\s+name: lg-agent-api-runtime/, 'API and migration must consume the external runtime Secret');

const imageLines = rendered
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('image: '));
if (imageLines.length < 4) failures.push('expected API, migration, Admin Web and Trainee Web images');
for (const line of imageLines) {
  const image = line.slice('image: '.length).replaceAll('"', '');
  if (!/:(?:v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|sha-[a-f0-9]{40})$/.test(image)) {
    failures.push(`floating or invalid production image tag: ${image}`);
  }
}

if (/^\s*(?:DATABASE_URL|JWT_SECRET|REDIS_URL|OPENAI_API_KEY|MINIO_SECRET_KEY)\s*:/m.test(productionValues)) {
  failures.push('production values must not contain plaintext credential keys');
}
if (/kind:\s*Secret\b/.test(rendered)) {
  failures.push('the production chart must not render credential-bearing Secret resources');
}
if (!/imagePullSecrets:\s*\n\s+- name: lg-agent-registry/.test(rendered)) {
  failures.push('production image pull Secret is not configured');
}

if (failures.length > 0) {
  process.stderr.write(`Helm production policy failed:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`Helm production policy passed for ${String(imageLines.length)} containers.\n`);
