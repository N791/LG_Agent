const http = require('http');
const assert = require('assert');
const jwt = require('./vendor/jsonwebtoken');

// We don't have supertest in sandbox, so we use native http
const request = (app) => {
  const server = http.createServer(app);

  return {
    get: (path, headers = {}) => {
      return new Promise((resolve, reject) => {
        server.listen(0, () => {
          const port = server.address().port;
          const options = {
            hostname: '127.0.0.1',
            port: port,
            path: path,
            method: 'GET',
            headers: headers,
          };

          const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              server.close();
              resolve({
                status: res.statusCode,
                body: data ? JSON.parse(data) : null,
              });
            });
          });

          req.on('error', (e) => {
            server.close();
            reject(e);
          });
          req.end();
        });
      });
    },
  };
};

async function runTests() {
  console.log('Starting automated tests...');
  let hasError = false;

  // Try to load user's app
  let app;
  try {
    app = require('./index');
  } catch (err) {
    console.error('Failed to load index.js:', err.message);
    process.exit(1);
  }

  const client = request(app);
  const SECRET = process.env.JWT_SECRET || 'super-secret-key';

  try {
    // Test 1: No Token
    console.log('Test 1: Testing missing token...');
    const res1 = await client.get('/api/protected');
    assert.strictEqual(res1.status, 401, 'Should return 401 when no token is provided');
    console.log('✅ Test 1 Passed');

    // Test 2: Valid Token
    console.log('Test 2: Testing valid token...');
    const validToken = jwt.sign({ userId: 123 }, SECRET);
    const res2 = await client.get('/api/protected', {
      Authorization: `Bearer ${validToken}`,
    });
    assert.strictEqual(res2.status, 200, 'Should return 200 when valid token is provided');
    console.log('✅ Test 2 Passed');

    // Test 3: Forged Token (Wrong Secret)
    console.log('Test 3: Testing forged token (vulnerability check)...');
    const forgedToken = jwt.sign({ userId: 999, admin: true }, 'attacker-wrong-secret');
    const res3 = await client.get('/api/protected', {
      Authorization: `Bearer ${forgedToken}`,
    });

    // The buggy implementation will return 200, but we expect 401
    assert.notStrictEqual(
      res3.status,
      200,
      'SECURITY ALERT: Forged token was accepted! You must verify the signature, not just decode.',
    );
    assert.strictEqual(res3.status, 401, 'Should return 401 when forged token is provided');
    console.log('✅ Test 3 Passed');
  } catch (err) {
    console.error(`❌ Test failed: ${err.message}`);
    hasError = true;
  }

  if (hasError) {
    console.error('\nSome tests failed. Please fix your code and try again.');
    process.exit(1);
  } else {
    console.log('\nAll tests passed! Great job!');
    process.exit(0);
  }
}

runTests();
