'use strict';

const { Router }          = require('express');
const { authenticate }    = require('../middleware/auth');
const { validateJobSubmit } = require('../middleware/validate');
const { handleGrpcError }   = require('../middleware/errors');
const { jobSubmitLimiter }  = require('../middleware/rateLimiter');
const { ingestionClient, storageClient } = require('../grpc/client');

const router = Router();

/**
 * POST /jobs
 * Submit a new distillation job.
 *
 * Body: { source: string, source_type: SourceType }
 *
 * Response 200: { job_id: string, status: string }
 */
router.post('/', authenticate, jobSubmitLimiter, validateJobSubmit, (req, res) => {
  const { source, source_type } = req.body;
  const user_id = req.user.user_id;

  ingestionClient.SubmitJob({ source, source_type, user_id }, (err, response) => {
    if (err) return handleGrpcError(err, res);
    res.json(response);
  });
});

/**
 * GET /jobs/:jobId
 * Get the current status of a job.
 *
 * Response 200: { job_id, status, error_message, created_at, updated_at }
 */
router.get('/:jobId', authenticate, (req, res) => {
  const { jobId } = req.params;

  if (!jobId || jobId.length < 10) {
    return res.status(400).json({ error: 'Validation Error', message: 'Invalid job_id' });
  }

  ingestionClient.GetJobStatus({ job_id: jobId }, (err, response) => {
    if (err) return handleGrpcError(err, res);
    res.json(response);
  });
});

module.exports = router;