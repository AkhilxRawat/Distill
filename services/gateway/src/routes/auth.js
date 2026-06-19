'use strict';

const { Router } = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { issueToken }  = require('../middleware/auth');

const router = Router();

/**
 * POST /auth/token
 * Issues a signed JWT for the given user_id.
 *
 * Body: { user_id: string, email?: string }
 *
 * In production this should validate credentials against a user store
 * (bcrypt hash comparison, email verification, etc.).
 * For now it trusts whatever user_id is supplied — wired to a real
 * user-management service in a later phase.
 */
router.post('/token', authLimiter, (req, res) => {
  const { user_id, email } = req.body;

  if (!user_id || typeof user_id !== 'string' || user_id.trim().length === 0) {
    return res.status(400).json({
      error:   'Validation Error',
      message: 'user_id is required',
    });
  }

  const token = issueToken(user_id.trim(), email);

  res.json({ token, user_id: user_id.trim() });
});

module.exports = router;