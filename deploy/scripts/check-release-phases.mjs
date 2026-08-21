import { readFileSync } from 'node:fs';

const [apiPhasePath, adminPhasePath, traineePhasePath, transactionPath] = process.argv.slice(2);
if (!apiPhasePath || !adminPhasePath || !traineePhasePath || !transactionPath) {
  throw new Error(
    'Usage: node check-release-phases.mjs <api.yaml> <admin.yaml> <trainee.yaml> <transaction.sh>',
  );
}

const phases = {
  api: readFileSync(apiPhasePath, 'utf8'),
  admin: readFileSync(adminPhasePath, 'utf8'),
  trainee: readFileSync(traineePhasePath, 'utf8'),
};
const transaction = readFileSync(transactionPath, 'utf8');
const failures = [];

function deployments(rendered) {
  return [...rendered.matchAll(/kind: Deployment[\s\S]*?app\.kubernetes\.io\/component: ([^\s]+)/g)]
    .map((match) => match[1])
    .sort();
}

const expected = {
  api: ['api'],
  admin: ['admin-web', 'api'],
  trainee: ['admin-web', 'api', 'trainee-web'],
};
for (const [phase, rendered] of Object.entries(phases)) {
  const actual = deployments(rendered);
  if (JSON.stringify(actual) !== JSON.stringify(expected[phase])) {
    failures.push(`${phase} phase deployments: expected ${expected[phase].join(', ')}, got ${actual.join(', ')}`);
  }
}

if (!/kind: Job[\s\S]*?component: migration/.test(phases.api)) {
  failures.push('API phase must include the migration/registry hook');
}
for (const phase of ['admin', 'trainee']) {
  if (/kind: Job[\s\S]*?component: migration/.test(phases[phase])) {
    failures.push(`${phase} phase must not replay the migration hook`);
  }
}

const orderedMarkers = [
  'Phase 1/3: migration, authorization registry and API',
  'health/ready',
  'Phase 2/3: Admin Web',
  'Phase 3/3: Trainee Web',
  'Running production authorization smoke suite',
];
let previous = -1;
for (const marker of orderedMarkers) {
  const index = transaction.indexOf(marker);
  if (index < 0 || index <= previous) failures.push(`release transaction order is missing or invalid at: ${marker}`);
  previous = index;
}
for (const requiredFlag of ['--atomic', '--wait', '--timeout', 'release.runMigration=true']) {
  if (!transaction.includes(requiredFlag)) failures.push(`release transaction is missing ${requiredFlag}`);
}

if (failures.length > 0) {
  process.stderr.write(`Release phase policy failed:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write('Release phases are ordered migration → API → Admin Web → Trainee Web → smoke.\n');
