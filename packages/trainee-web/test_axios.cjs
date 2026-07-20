const axios = require('axios');

const request = axios.create({
  baseURL: 'http://localhost:4000/api/v1',
  timeout: 5000,
});

request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== undefined && res.code !== 200 && res.code !== 201) {
      return Promise.reject(new Error(res.message ?? 'Request failed'));
    }
    return res.data !== undefined ? res.data : res;
  },
  (error) => {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
);

async function run() {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({
    username: 'trainee',
    sub: '02b0cadd-57e8-47e2-95cc-09855c5ccfc4', // Just use some ID, doesn't matter for read 
    role: 'TRAINEE',
  }, 'super-secret-key-for-development', { expiresIn: '60m' });

  request.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  const courseId = '00000000-0000-0000-0000-000000000001';

  try {
    const [courseData, progressData, recentData, achievementsData] = await Promise.all([
      request.get(`/courses/${courseId}`),
      request.get(courseId ? `/training/progress?courseId=${courseId}` : '/training/progress'),
      request.get('/training/recent'),
      request.get('/achievements/me'),
    ]);
    console.log('Promise.all 1 succeeded');
    
    const response = await request.get(`/tasks?courseId=${courseId}`);
    console.log('Tasks fetch succeeded');
  } catch (err) {
    console.error('FAILED!', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

run();
