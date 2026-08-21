import fs from 'node:fs';

const packages = ['api', 'web', 'trainee-web', 'cli'];
const failures = [];
for (const name of packages) {
  const manifest = JSON.parse(fs.readFileSync(`packages/${name}/package.json`, 'utf8'));
  const version =
    manifest.dependencies?.['@lg-agent/contracts'] ??
    manifest.devDependencies?.['@lg-agent/contracts'];
  if (version !== 'workspace:^') failures.push(`${name}: ${version ?? 'missing'}`);
}
if (failures.length) {
  process.stderr.write(`Contract package versions are inconsistent:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write('API, Web, Trainee Web and CLI use @lg-agent/contracts workspace:^.\n');
