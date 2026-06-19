const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for auth endpoints — prevent credential stuffing.
 * 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error:   'Too Many Requests',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

/**
 * General API limiter — prevent abuse of job submission / result fetching.
 * 100 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error:   'Too Many Requests',
    message: 'Rate limit exceeded. Please slow down your requests.',
  },
});

/**
 * Job submission limiter — prevent runaway Gemini API costs.
 * 20 job submissions per 10 minutes per IP.
 */
const jobSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error:   'Too Many Requests',
    message: 'Too many jobs submitted. Please wait before submitting more.',
  },
});

module.exports = { authLimiter, apiLimiter, jobSubmitLimiter };