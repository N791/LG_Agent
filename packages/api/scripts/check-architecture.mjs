import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../../..');
const apiModules = path.join(root, 'packages/api/src/modules');
const contractsSrc = path.join(root, 'packages/contracts/src');
const permissionRegistryFile = path.join(contractsSrc, 'authorization.ts');
const sourceExtensions = new Set(['.ts', '.tsx']);
const implementationSegments =
  /(?:^|\/)(?:internal|repositories?|strategies|providers|adapters?)(?:\/|$)|\.(?:repository|strategy|provider|adapter)$/;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walk(target)
      : sourceExtensions.has(path.extname(entry.name))
        ? [target]
        : [];
  });
}

function importsOf(file) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = new Set();
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) imports.add(match[1]);
  for (const match of source.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) imports.add(match[1]);
  return [...imports];
}

function moduleName(file) {
  return path.relative(apiModules, file).split(path.sep)[0];
}

function resolveDomainImport(file, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const resolved = path.resolve(path.dirname(file), specifier);
  const relative = path.relative(apiModules, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  return relative.split(path.sep)[0];
}

const errors = [];
const graph = new Map();
const productionFiles = walk(apiModules).filter(
  (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
);
const permissionNames = new Set(
  [...fs.readFileSync(permissionRegistryFile, 'utf8').matchAll(/^\s+([A-Z][A-Z0-9_]+):\s+'/gm)].map(
    (match) => match[1],
  ),
);

for (const file of productionFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const owner = moduleName(file);
  graph.set(owner, graph.get(owner) ?? new Set());
  for (const specifier of importsOf(file)) {
    const dependency = resolveDomainImport(file, specifier);
    if (!dependency || dependency === owner) continue;
    const normalized = specifier.replaceAll('\\', '/');
    if (file.endsWith('.module.ts')) graph.get(owner).add(dependency);
    if (implementationSegments.test(normalized)) {
      errors.push(
        `${path.relative(root, file)} imports another domain's implementation: ${specifier}`,
      );
    }
    if (file.endsWith('.controller.ts') && /\.service$/.test(normalized)) {
      errors.push(
        `${path.relative(root, file)} calls another domain service instead of its own public interface: ${specifier}`,
      );
    }
  }
  if (file.endsWith('.controller.ts')) {
    if (/@Roles\s*\(|RolesGuard/.test(source)) {
      errors.push(`${path.relative(root, file)} still uses the legacy role authorization system.`);
    }
    if (!/@Public\s*\(|@RequireAuthenticated\s*\(|@Require(?:Any)?Permission\s*\(/.test(source)) {
      errors.push(`${path.relative(root, file)} has no explicit public or permission policy.`);
    }
    for (const match of source.matchAll(/PERMISSIONS\.([A-Z][A-Z0-9_]*)/g)) {
      if (!permissionNames.has(match[1])) {
        errors.push(
          `${path.relative(root, file)} references unknown permission PERMISSIONS.${match[1]}.`,
        );
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
function visit(node, stack) {
  if (visiting.has(node)) {
    const start = stack.indexOf(node);
    errors.push(`Circular domain dependency: ${[...stack.slice(start), node].join(' -> ')}`);
    return;
  }
  if (visited.has(node)) return;
  visiting.add(node);
  for (const dependency of graph.get(node) ?? []) visit(dependency, [...stack, node]);
  visiting.delete(node);
  visited.add(node);
}
for (const node of graph.keys()) visit(node, []);

for (const file of walk(contractsSrc)) {
  for (const specifier of importsOf(file)) {
    if (/^@nestjs\/|^@prisma\/|^react(?:\/|$)|redux|zustand|mobx/.test(specifier)) {
      errors.push(
        `${path.relative(root, file)} makes @lg-agent/contracts depend on an implementation: ${specifier}`,
      );
    }
  }
}

const domainDirectories = fs
  .readdirSync(apiModules, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((domain) =>
    walk(path.join(apiModules, domain)).some((file) => file.endsWith('.module.ts')),
  );
for (const domain of domainDirectories) {
  if (!fs.existsSync(path.join(apiModules, domain, 'index.ts'))) {
    errors.push(`Domain ${domain} is missing its public index.ts interface.`);
  }
}

if (errors.length > 0) {
  console.error(`Architecture checks failed (${errors.length.toString()}):`);
  for (const error of [...new Set(errors)].sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Architecture checks passed for ${productionFiles.length.toString()} API files and contracts.`,
);
