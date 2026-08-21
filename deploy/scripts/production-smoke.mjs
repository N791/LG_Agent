const required = [
  'SMOKE_API_URL',
  'SMOKE_ADMIN_URL',
  'SMOKE_TRAINEE_URL',
  'SMOKE_ADMIN_USERNAME',
  'SMOKE_ADMIN_PASSWORD',
  'SMOKE_TARGET_USERNAME',
  'SMOKE_TARGET_PASSWORD',
  'SMOKE_ROLE_ID',
  'SMOKE_ROLE_NAME',
  'SMOKE_TARGET_USER_ID',
  'SMOKE_EXPECTED_PERMISSION',
  'SMOKE_CROSS_ORG_PATH',
];

for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`Missing smoke configuration ${name}`);
}

const api = process.env['SMOKE_API_URL'].replace(/\/$/, '');

async function request(path, init = {}, expected = [200]) {
  const response = await fetch(`${api}${path}`, init);
  const text = await response.text();
  if (!expected.includes(response.status)) {
    throw new Error(`${init.method ?? 'GET'} ${path}: expected ${expected.join('/')}, got ${response.status}: ${text}`);
  }
  if (!text) return undefined;
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
}

async function login(username, password) {
  const body = await request(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    [200],
  );
  const token = body?.access_token ?? body?.accessToken;
  if (!token) throw new Error(`Login response for ${username} did not include an access token`);
  return token;
}

function auth(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

await request('/api/v1/health');
const ready = await request('/api/v1/health/ready');
if (ready?.info?.permissionRegistry?.status !== 'up') {
  throw new Error('Permission registry is not ready');
}

for (const url of [process.env['SMOKE_ADMIN_URL'], process.env['SMOKE_TRAINEE_URL']]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Web smoke failed for ${url}: ${response.status}`);
}

const adminToken = await login(
  process.env['SMOKE_ADMIN_USERNAME'],
  process.env['SMOKE_ADMIN_PASSWORD'],
);
const targetToken = await login(
  process.env['SMOKE_TARGET_USERNAME'],
  process.env['SMOKE_TARGET_PASSWORD'],
);
const before = await request('/api/v1/me/permissions', { headers: auth(targetToken) });
if (!Number.isInteger(before?.registryVersion)) throw new Error('/me/permissions has no registryVersion');

const membershipPath = `/api/v1/authorization/roles/${process.env['SMOKE_ROLE_ID']}/members`;
await request(membershipPath, {
  method: 'PUT',
  headers: auth(adminToken),
  body: JSON.stringify({
    userIds: [process.env['SMOKE_TARGET_USER_ID']],
    confirmation: process.env['SMOKE_ROLE_NAME'],
    replace: true,
  }),
});
const assigned = await request('/api/v1/me/permissions', { headers: auth(targetToken) });
if (!assigned?.permissions?.includes(process.env['SMOKE_EXPECTED_PERMISSION'])) {
  throw new Error('Role assignment did not become visible to the target user');
}
await request(membershipPath, {
  method: 'PUT',
  headers: auth(adminToken),
  body: JSON.stringify({
    userIds: [],
    confirmation: process.env['SMOKE_ROLE_NAME'],
    replace: true,
  }),
});

for (let attempt = 0; attempt < 8; attempt += 1) {
  const permissions = await request('/api/v1/me/permissions', { headers: auth(targetToken) });
  if (permissions?.registryVersion !== before.registryVersion) {
    throw new Error('Mixed permission registry versions observed after revocation');
  }
  if (permissions?.permissions?.includes(process.env['SMOKE_EXPECTED_PERMISSION'])) {
    throw new Error(`Revoked permission remained visible on load-balanced attempt ${String(attempt + 1)}`);
  }
}

await request(process.env['SMOKE_CROSS_ORG_PATH'], { headers: auth(targetToken) }, [403, 404]);
const audit = await request('/api/v1/observability/audit', { headers: auth(adminToken) });
if (!JSON.stringify(audit).includes('authorization.role.members_changed')) {
  throw new Error('Authorization membership smoke did not produce a readable audit event');
}
process.stdout.write('Production smoke passed: health, clients, login, permissions, revocation, tenant denial and audit.\n');
