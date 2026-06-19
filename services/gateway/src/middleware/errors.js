'use strict';

/**
 * Maps gRPC status codes to HTTP status codes.
 * https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
const GRPC_TO_HTTP = {
  0:  200, // OK
  1:  499, // CANCELLED
  2:  500, // UNKNOWN
  3:  400, // INVALID_ARGUMENT
  4:  504, // DEADLINE_EXCEEDED
  5:  404, // NOT_FOUND
  6:  409, // ALREADY_EXISTS
  7:  403, // PERMISSION_DENIED
  8:  429, // RESOURCE_EXHAUSTED
  9:  400, // FAILED_PRECONDITION
  10: 409, // ABORTED
  11: 400, // OUT_OF_RANGE
  12: 501, // UNIMPLEMENTED
  13: 500, // INTERNAL
  14: 503, // UNAVAILABLE
  15: 500, // DATA_LOSS
  16: 401, // UNAUTHENTICATED
};

/**
 * Converts a gRPC error into an HTTP response.
 */
function handleGrpcError(err, res) {
  const httpStatus = GRPC_TO_HTTP[err.code] || 500;

  // Service unavailable — give a helpful hint
  if (err.code === 14) {
    return res.status(503).json({
      error:   'Service Unavailable',
      message: 'A backend service is temporarily unavailable. Please try again shortly.',
    });
  }

  res.status(httpStatus).json({
    error:   err.details || err.message || 'Internal Server Error',
    message: err.message,
  });
}

/**
 * Express error-handling middleware (4-argument signature required).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[gateway] Unhandled error:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid JSON body' });
  }

  res.status(500).json({ error: 'Internal Server Error', message: err.message });
}

module.exports = { handleGrpcError, errorHandler };