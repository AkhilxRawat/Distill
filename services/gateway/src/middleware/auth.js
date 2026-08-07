const jwt = require('jsonwebtoken');
const { trace } = require('@opentelemetry/api');
const { errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-gateway');
const JWT_SECRET = process.env.JWT_SECRET || 'distill-secret-change-me';

/**
 * Verifies Bearer JWT in Authorization header.
 * Attaches decoded payload to req.user on success.
 */
function authenticate(req, res, next) {
  const span = tracer.startSpan('auth.verify_token');
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    errorsTotal.inc({ service: 'gateway', reason: 'missing_auth_header' });
    span.end();
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = auth.slice(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user && (req.user.user_id || req.user.userId)) {
      span.setAttribute('user.id', req.user.user_id || req.user.userId);
    }
    span.end();
    next();
  } catch (err) {
    errorsTotal.inc({ service: 'gateway', reason: 'invalid_token' });
    span.end();
    const message = err.name === 'TokenExpiredError'
      ? 'Token has expired — please re-authenticate'
      : 'Invalid token';

    return res.status(401).json({ error: 'Unauthorized', message });
  }
}

/**
 * Issues a signed JWT for a user_id.
 * In production this should validate credentials against a user store.
 */
function issueToken(user_id, email) {
  return jwt.sign({ user_id, email }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authenticate, issueToken };