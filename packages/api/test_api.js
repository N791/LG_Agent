const { PrismaClient } = require('./node_modules/@prisma/client');
const jwt = require('./node_modules/jsonwebtoken');
const http = require('http');

async function run() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { username: 'trainee' } });
  await prisma.$disconnect();

  const payload = {
    username: user.username,
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId,
  };

  const token = jwt.sign(payload, 'super-secret-key-for-development', { expiresIn: '60m' });
  console.log('Got token');

  const headers = { Authorization: 'Bearer ' + token };

  // Fetch courses
  http.get('http://localhost:4000/api/v1/courses/00000000-0000-0000-0000-000000000001', { headers }, (res) => {
    console.log('courses status:', res.statusCode);
    let data = ''; res.on('data', c => data += c); res.on('end', () => console.log('courses:', data));
  });

  // Fetch progress
  http.get('http://localhost:4000/api/v1/training/progress?courseId=00000000-0000-0000-0000-000000000001', { headers }, (res) => {
    console.log('progress status:', res.statusCode);
    let data = ''; res.on('data', c => data += c); res.on('end', () => console.log('progress:', data));
  });

  // Fetch recent
  http.get('http://localhost:4000/api/v1/training/recent', { headers }, (res) => {
    console.log('recent status:', res.statusCode);
    let data = ''; res.on('data', c => data += c); res.on('end', () => console.log('recent:', data));
  });

  // Fetch achievements
  http.get('http://localhost:4000/api/v1/achievements/me', { headers }, (res) => {
    console.log('achievements status:', res.statusCode);
    let data = ''; res.on('data', c => data += c); res.on('end', () => console.log('achievements:', data));
  });

  // Fetch tasks
  http.get('http://localhost:4000/api/v1/tasks?courseId=00000000-0000-0000-0000-000000000001', { headers }, (res) => {
    console.log('tasks status:', res.statusCode);
    let data = ''; res.on('data', c => data += c); res.on('end', () => console.log('tasks:', data));
  });

  // Fetch timeline
  http.get('http://localhost:4000/api/v1/training/timeline/00000000-0000-0000-0000-000000000001', { headers }, (res) => {
    console.log('timeline status:', res.statusCode);
    let data = ''; res.on('data', c => data += c); res.on('end', () => console.log('timeline:', data));
  });
}
run();
