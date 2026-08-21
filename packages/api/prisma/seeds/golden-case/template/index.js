const jwt = require('./vendor/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// TODO: Fix the security vulnerability in this middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendJson(res, 401, { message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // BUG: jwt.decode only decodes the payload, it DOES NOT verify the signature!
    // This allows attackers to forge any token and bypass authentication.
    const decoded = jwt.decode(token);

    if (!decoded) {
      return sendJson(res, 401, { message: 'Unauthorized: Invalid token payload' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return sendJson(res, 401, { message: 'Unauthorized: Invalid token' });
  }
};

const app = (req, res) => {
  if (req.method !== 'GET' || req.url !== '/api/protected') {
    return sendJson(res, 404, { message: 'Not found' });
  }
  return authMiddleware(req, res, () => sendJson(res, 200, { message: 'Success', user: req.user }));
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Export the app for testing
module.exports = app;

// Run-mode smoke output; behavioral tests create their own short-lived server.
if (require.main === module) {
  // The training runner is non-interactive and network-disabled. Loading the
  // request handler is the Run action; the controlled test script owns a
  // short-lived loopback server for behavioral verification.
  console.log('Gateway handler loaded successfully. Run Test to verify authentication behavior.');
}
