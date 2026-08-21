import fs from 'node:fs';

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  throw new Error('Usage: node check-openapi-breaking.mjs <baseline.json> <candidate.json>');
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const failures = [];

for (const [route, oldPath] of Object.entries(baseline.paths ?? {})) {
  const nextPath = candidate.paths?.[route];
  if (!nextPath) {
    failures.push(`removed path ${route}`);
    continue;
  }
  for (const method of Object.keys(oldPath)) {
    if (['parameters', 'summary', 'description'].includes(method)) continue;
    if (!nextPath[method]) failures.push(`removed operation ${method.toUpperCase()} ${route}`);
  }
}

for (const [name, oldSchema] of Object.entries(baseline.components?.schemas ?? {})) {
  const nextSchema = candidate.components?.schemas?.[name];
  if (!nextSchema) {
    failures.push(`removed schema ${name}`);
    continue;
  }
  const oldRequired = new Set(oldSchema.required ?? []);
  for (const property of nextSchema.required ?? []) {
    if (!oldRequired.has(property)) failures.push(`made ${name}.${property} required`);
  }
  for (const property of Object.keys(oldSchema.properties ?? {})) {
    if (!(property in (nextSchema.properties ?? {}))) failures.push(`removed property ${name}.${property}`);
  }
}

if (failures.length) {
  process.stderr.write(`Breaking OpenAPI changes:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write('No breaking OpenAPI changes detected.\n');
