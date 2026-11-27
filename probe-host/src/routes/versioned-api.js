const { randomUUID, timingSafeEqual } = require('node:crypto');

function apiContext(_req, res, next) {
  const requestId = randomUUID();
  res.set('Cache-Control', 'no-store');
  res.set('X-Request-Id', requestId);
  res.locals.fail = (status, code, message) => res.status(status).json({ error: { code, message, request_id: requestId } });
  next();
}

function requireApiToken(token) {
  const expected = Buffer.from(`Bearer ${token}`);
  return (req, res, next) => {
    const received = Buffer.from(req.get('Authorization') ?? '');
    if (token && received.length === expected.length && timingSafeEqual(received, expected)) return next();
    res.set('WWW-Authenticate', 'Bearer');
    return res.locals.fail(401, 'UNAUTHORIZED', 'A valid IP Watch token is required.');
  };
}

module.exports = { apiContext, requireApiToken };
