// Pinned training-only HS256 subset. The readonly hidden fixture keeps the
// Golden Case deterministic in a network-disabled sandbox.
const crypto = require('crypto');

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(token) {
  const payload = String(token).split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function sign(payload, secret) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const unsigned = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verify(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('invalid token');
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error('invalid signature');
  }
  const payload = decode(token);
  if (!payload) throw new Error('invalid payload');
  return payload;
}

module.exports = { decode, sign, verify };
