const { trace } = require('@opentelemetry/api');
const Result = require('../db/models/result');
const { storageDurationSeconds, errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-storage');

async function deleteResult(call, callback) {
  const { result_id, user_id } = call.request;
  const timer = storageDurationSeconds.startTimer({ operation: 'delete_result' });
  const span = tracer.startSpan('storage.query');
  span.setAttribute('collection', 'results');
  span.setAttribute('operation', 'deleteOne');

  try {
    const doc = await Result.findOneAndDelete({ resultId: result_id, userId: user_id });
    const traceId = span.spanContext().traceId;
    span.end();
    timer(undefined, { trace_id: traceId });

    if (!doc) {
      errorsTotal.inc({ service: 'storage', reason: 'result_not_found' });
      return callback({ code: 5, message: 'Result not found' });
    }

    callback(null, { success: true });
  } catch (err) {
    const traceId = span.spanContext().traceId;
    span.recordException(err);
    span.end();
    timer(undefined, { trace_id: traceId });
    errorsTotal.inc({ service: 'storage', reason: 'delete_result_failed' });
    console.error('deleteResult error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { deleteResult };
