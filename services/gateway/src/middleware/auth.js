const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'distill-secret-change-me';

/**
 * Verifies Bearer JWT in Authorization header.
 * Attaches decoded payload to req.user on success.
 */
function authenticate(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = auth.slice(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
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