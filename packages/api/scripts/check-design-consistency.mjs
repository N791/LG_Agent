import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../../..');
const designDirectory = path.join(root, 'Design_docs/Design');
const apiSource = path.join(root, 'packages/api/src');
const schema = fs.readFileSync(path.join(root, 'packages/api/prisma/schema.prisma'), 'utf8');

const designFiles = new Map(
  fs
    .readdirSync(designDirectory)
    .filter((name) => /^0[1-9]_/.test(name))
    .map((name) => [name.slice(0, 2), fs.readFileSync(path.join(designDirectory, name), 'utf8')]),
);
const failures = [];

function requireText(documentNumber, pattern, description) {
  const document = designFiles.get(documentNumber);
  if (!document || !pattern.test(document)) {
    failures.push(`${documentNumber}: missing ${description}`);
  }
}

function rejectText(documentNumber, pattern, description) {
  const document = designFiles.get(documentNumber);
  if (document && pattern.test(document)) {
    failures.push(`${documentNumber}: stale claim: ${description}`);
  }
}

if (designFiles.size !== 9)
  failures.push(`expected design documents 01-09, found ${designFiles.size}`);

requireText('01', /模块化单体/, 'the current modular-monolith topology');
requireText('02', /PostgreSQL lease queue \+ durable event log/, 'the durable execution stack');
requireText('03', /submissions\/run.*唯一入口/s, 'the canonical Submission entry');
requireText('03', /WorkspaceSession.*唯一拥有/s, 'WorkspaceSession state ownership');
requireText('04', /database execution adapter.*lease\/heartbeat/s, 'durable execution flow');
for (const provider of ['OpenAI', 'DeepSeek', 'Mock']) {
  requireText('05', new RegExp(`${provider}(?:Provider| Provider|、)`), `${provider} provider`);
}
requireText('05', /Qwen.*不是独立 adapter/s, 'the Qwen compatibility boundary');
requireText('06', /ExecutionWorkspaceService.*符号链接\/junction/s, 'execution containment');
requireText('07', /knowledge_vectors.*pgvector/s, 'the persistent vector-store model');
requireText('08', /training\/submit.*已移除/s, 'legacy endpoint removal');
requireText('09', /AuthConfigModule/, 'centralized authentication configuration');
requireText('09', /生产启动不创建默认账号/, 'the production bootstrap invariant');

rejectText('03', /当前同时使用 `WorkspaceService\.currentWorkspace`/, 'duplicate workspace truth');
rejectText('04', /当前偏差.*training\/submit/s, 'two submission entry points');
rejectText('06', /尚未落实.*containment/, 'missing execution containment');
rejectText('09', /当前会创建 `admin\/admin123`/, 'default production credentials');

for (const model of ['Submission', 'ExecutionEvent', 'KnowledgeVector', 'LlmRequestLog']) {
  if (!new RegExp(`model\\s+${model}\\b`).test(schema)) {
    failures.push(`Prisma schema is missing documented model ${model}`);
  }
}

const productionSources = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      productionSources.push(fs.readFileSync(target, 'utf8'));
    }
  }
}
walk(apiSource);
const joinedSources = productionSources.join('\n');
if (joinedSources.includes('@nestjs/microservices')) {
  failures.push('an independent NestJS microservice network seam was introduced without a trigger');
}
if (/@(Post|Put|Patch)\(['"]submit['"]\)/.test(joinedSources)) {
  failures.push('legacy training submit route still exists');
}

if (failures.length > 0) {
  process.stderr.write(`Design consistency checks failed:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}

process.stdout.write(
  'Design documents 01-09 match the modular-monolith, endpoint, execution and schema baseline.\n',
);
