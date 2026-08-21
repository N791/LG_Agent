import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const androidRoot = path.resolve(scriptDir, '..');
const repositoryRoot = path.resolve(androidRoot, '..', '..');
const typescriptContract = fs.readFileSync(
  path.join(repositoryRoot, 'packages', 'contracts', 'src', 'dto', 'mobile.dto.ts'),
  'utf8',
);
const kotlinModels = fs.readFileSync(
  path.join(
    androidRoot,
    'app',
    'src',
    'main',
    'java',
    'com',
    'lgagent',
    'mobile',
    'model',
    'MobileModels.kt',
  ),
  'utf8',
);

const enumNames = ['MobileTaskStage', 'MobileTaskStatus', 'MobileNextActionType'];
const failures = [];

for (const enumName of enumNames) {
  const tsBody = extractEnum(typescriptContract, enumName, /export enum\s+/);
  const kotlinBody = extractEnum(kotlinModels, enumName, /enum class\s+/);
  const tsValues = [...tsBody.matchAll(/\b[A-Z][A-Z0-9_]+\s*=\s*'[A-Z][A-Z0-9_]+'/g)]
    .map(([entry]) => entry.split('=')[0].trim())
    .sort();
  const kotlinValues = [...kotlinBody.matchAll(/\b[A-Z][A-Z0-9_]+\b/g)]
    .map(([entry]) => entry)
    .sort();
  if (JSON.stringify(tsValues) !== JSON.stringify(kotlinValues)) {
    failures.push(`${enumName} differs: TS=${tsValues.join(',')} Kotlin=${kotlinValues.join(',')}`);
  }
}

const requiredTaskFields = [
  'id',
  'title',
  'summary',
  'status',
  'currentStage',
  'stagePosition',
  'requiresPc',
  'blockedReason',
  'nextAction',
];

for (const field of requiredTaskFields) {
  if (!new RegExp(`\\b${field}[?:]?\\s*:`).test(typescriptContract)) {
    failures.push(`TypeScript MobileTaskSummaryDTO is missing ${field}`);
  }
  if (!new RegExp(`\\bval\\s+${field}\\s*:`).test(kotlinModels)) {
    failures.push(`Kotlin MobileTaskSummary is missing ${field}`);
  }
}

if (!/MOBILE_READ_MODEL_VERSION\s*=\s*1\b/.test(typescriptContract)) {
  failures.push('Unexpected TypeScript mobile read-model version');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Mobile TypeScript/Kotlin contract compatibility check passed.');

function extractEnum(source, name, prefix) {
  const start = source.search(new RegExp(`${prefix.source}${name}\\s*\\{`));
  if (start < 0) throw new Error(`Missing enum ${name}`);
  const bodyStart = source.indexOf('{', start) + 1;
  const bodyEnd = source.indexOf('}', bodyStart);
  if (bodyEnd < 0) throw new Error(`Unterminated enum ${name}`);
  return source.slice(bodyStart, bodyEnd);
}
