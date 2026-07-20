const jwt = require('./packages/api/node_modules/jsonwebtoken');
const { PrismaClient } = require('./packages/api/node_modules/@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { username: 'trainee' } });
  await prisma.$disconnect();

  const token = jwt.sign({
    username: user.username,
    sub: user.id, 
    role: user.role,
    organizationId: user.organizationId
  }, process.env.JWT_SECRET || 'super-secret-key-for-development', { expiresIn: '60m' });

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json'
  };

  const courseId = '00000000-0000-0000-0000-000000000001';
  const baseUrl = 'http://localhost:4000/api/v1';

  async function req(url) {
    const res = await fetch(baseUrl + url, { headers });
    const text = await res.text();
      if (res.ok) {
        console.log(`Endpoint ${url} succeeded`);
      } else {
        console.log(`Endpoint ${url} failed: HTTP ${res.status}: ${text}`);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
    return JSON.parse(text);
  }

  try {
    await req('/courses/' + courseId).catch(() => {});
    await Promise.all([
      req('/tasks?courseId=' + courseId),
      req('/discussions?courseId=' + courseId),
      req('/workspaces/00000000-0000-0000-0000-000000000002')
    ]).catch(err => {});
  } catch (err) {
    console.error('FAILED!', err.message);
  }
}

run();
