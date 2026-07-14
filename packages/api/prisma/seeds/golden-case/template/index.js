const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// TODO: Fix the security vulnerability in this middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // BUG: jwt.decode only decodes the payload, it DOES NOT verify the signature!
    // This allows attackers to forge any token and bypass authentication.
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token payload' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Success', user: req.user });
});

// Export the app for testing
module.exports = app;

// Only listen if not imported by tests
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Gateway running on port ${port}`);
  });
}
