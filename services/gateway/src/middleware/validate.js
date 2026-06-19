'use strict';

const VALID_SOURCE_TYPES = new Set([
  'SOURCE_TYPE_YOUTUBE_URL',
  'SOURCE_TYPE_ARTICLE_URL',
  'SOURCE_TYPE_RAW_TEXT',
]);

const YOUTUBE_RE  = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;
const URL_RE      = /^https?:\/\/.{3,}/;

/**
 * Validates POST /jobs body.
 * Checks source_type enum, source format, and raw text length.
 */
function validateJobSubmit(req, res, next) {
  const { source, source_type } = req.body;

  if (!source_type || !VALID_SOURCE_TYPES.has(source_type)) {
    return res.status(400).json({
      error:   'Validation Error',
      message: `source_type must be one of: ${[...VALID_SOURCE_TYPES].join(', ')}`,
    });
  }

  if (!source || typeof source !== 'string' || source.trim().length === 0) {
    return res.status(400).json({
      error:   'Validation Error',
      message: 'source is required and must be a non-empty string',
    });
  }

  const s = source.trim();

  if (source_type === 'SOURCE_TYPE_YOUTUBE_URL') {
    if (!YOUTUBE_RE.test(s)) {
      return res.status(400).json({
        error:   'Validation Error',
        message: 'source must be a valid YouTube URL (youtube.com/watch?v=... or youtu.be/...)',
      });
    }
  }

  if (source_type === 'SOURCE_TYPE_ARTICLE_URL') {
    if (!URL_RE.test(s)) {
      return res.status(400).json({
        error:   'Validation Error',
        message: 'source must be a valid HTTP/HTTPS URL',
      });
    }
  }

  if (source_type === 'SOURCE_TYPE_RAW_TEXT') {
    if (s.length < 50) {
      return res.status(400).json({
        error:   'Validation Error',
        message: 'Raw text must be at least 50 characters',
      });
    }
    if (s.length > 100_000) {
      return res.status(400).json({
        error:   'Validation Error',
        message: 'Raw text must not exceed 100,000 characters',
      });
    }
  }

  req.body.source = s; // normalise whitespace
  next();
}

/**
 * Validates pagination query params for GET /results.
 */
function validatePagination(req, res, next) {
  const page      = parseInt(req.query.page      || '1',  10);
  const page_size = parseInt(req.query.page_size || '10', 10);

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ error: 'Validation Error', message: 'page must be a positive integer' });
  }
  if (isNaN(page_size) || page_size < 1 || page_size > 100) {
    return res.status(400).json({ error: 'Validation Error', message: 'page_size must be between 1 and 100' });
  }

  req.pagination = { page, page_size };
  next();
}

module.exports = { validateJobSubmit, validatePagination };