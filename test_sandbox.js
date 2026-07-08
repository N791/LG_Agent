async function run() {
  const baseURL = 'http://localhost:3000/api/v1';

  try {
    // 1. Login to get token
    console.log('Logging in...');
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    if (!loginRes.ok) throw new Error(await loginRes.text());
    const loginData = await loginRes.json();
    const token = loginData.data.access_token;
    console.log('Got token:', token);

    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json' 
    };

    // 2. Create Course
    console.log('Creating course...');
    const courseRes = await fetch(`${baseURL}/courses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Sandbox Test Course', version: 'v1.0' })
    });
    if (!courseRes.ok) throw new Error(await courseRes.text());
    const courseData = await courseRes.json();
    const courseId = courseData.data.id;
    console.log('Course ID:', courseId);

    // 3. Create Task
    console.log('Creating task...');
    const taskRes = await fetch(`${baseURL}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        courseId,
        title: 'Sandbox Test Task',
        stage: 1,
        envConfig: { 
          node: true, 
          docker: true,
        },
        sandboxConfig: {},
        promptConfig: {},
        testConfig: {
          script: `
const fs = require('fs');
if (fs.existsSync('./index.js')) {
  require('./index.js');
} else {
  throw new Error('index.js not found');
}
console.log('Test executed successfully!');
          `
        },
      })
    });
    if (!taskRes.ok) throw new Error(await taskRes.text());
    const taskData = await taskRes.json();
    const taskId = taskData.data.id;
    console.log('Task ID:', taskId);

    // 4. Submit code to sandbox
    console.log('Submitting code to Training Engine...');
    const submitRes = await fetch(`${baseURL}/training/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskId,
        code: `console.log("Hello from Pseudo Sandbox!");`,
      })
    });
    if (!submitRes.ok) throw new Error(await submitRes.text());
    const submitData = await submitRes.json();

    console.log('--- Sandbox Execution Result ---');
    console.log(submitData);
    console.log('--------------------------------');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
