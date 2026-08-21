import fs from 'node:fs';

const [documentPath, openapiPath] = process.argv.slice(2);
if (!documentPath || !openapiPath) {
  throw new Error('Usage: node check-endpoint-map.mjs <core-api.md> <openapi.json>');
}
const markdown = fs.readFileSync(documentPath, 'utf8');
const openapi = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
const rows = [...markdown.matchAll(/\|\s*[^|]+\|\s*`([A-Z/]+)\s+(\/api\/v1\/[^`]+)`\s*\|/g)];
if (!rows.length) throw new Error('No endpoint map rows found in core API design document.');
const missing = [];
for (const row of rows) {
  const methods = row[1].split('/');
  const route = row[2].replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  for (const method of methods) {
    if (!openapi.paths?.[route]?.[method.toLowerCase()]) {
      missing.push(`${method} ${row[2]}`);
    }
  }
}
if (missing.length) {
  process.stderr.write(`Endpoint map entries missing from OpenAPI:\n- ${missing.join('\n- ')}\n`);
  process.exit(1);
}
process.stdout.write(`Validated ${rows.length} endpoint map rows against OpenAPI.\n`);
