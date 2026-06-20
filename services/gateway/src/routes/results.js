'use strict';

const { Router }          = require('express');
const { authenticate }    = require('../middleware/auth');
const { validatePagination } = require('../middleware/validate');
const { handleGrpcError }    = require('../middleware/errors');
const { storageClient }      = require('../grpc/client');

const router = Router();

router.use(authenticate);

/**
 * GET /results
 * List all distilled results for the authenticated user, newest first.
 *
 * Query params:
 *   page      (default 1)
 *   page_size (default 10, max 100)
 *
 * Response 200: { results: Result[], total: number }
 */
router.get('/', validatePagination, (req, res) => {
  const { page, page_size } = req.pagination;

  storageClient.ListResults(
    { user_id: req.user.user_id, page, page_size },
    (err, response) => {
      if (err) return handleGrpcError(err, res);
      res.json(response);
    }
  );
});

/**
 * GET /results/:resultId
 * Fetch a single distilled result.
 * Enforces ownership — users can only fetch their own results.
 *
 * Response 200: Result object
 * Response 404: result not found (or belongs to another user)
 */
router.get('/:resultId', (req, res) => {
  const { resultId } = req.params;

  if (!resultId || resultId.length < 10) {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid result_id' });
  }

  storageClient.GetResult(
    { result_id: resultId, user_id: req.user.user_id },
    (err, response) => {
      if (err) return handleGrpcError(err, res);
      res.json(response.result);
    }
  );
});

module.exports = router;