const { trace } = require('@opentelemetry/api');
const Result = require('../db/models/result');
const { storageDurationSeconds, errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-storage');

async function getResult(call, callback) {
  const { result_id, user_id } = call.request;
  const timer = storageDurationSeconds.startTimer({ operation: 'get_result' });
  const span = tracer.startSpan('storage.query');
  span.setAttribute('collection', 'results');
  span.setAttribute('operation', 'findOne');

  try {
    const doc = await Result.findOne({ resultId: result_id, userId: user_id });
    const traceId = span.spanContext().traceId;
    span.end();
    timer(undefined, { trace_id: traceId });

    if (!doc) {
      errorsTotal.inc({ service: 'storage', reason: 'result_not_found' });
      return callback({ code: 5, message: 'Result not found' });
    }

    callback(null, {
      result: {
        result_id:        doc.resultId,
        job_id:           doc.jobId,
        user_id:          doc.userId,
        source:           doc.source,
        source_type:      doc.sourceType,
        summary:          doc.summary,
        key_entities:     doc.keyEntities,
        qa_pairs:         doc.qaPairs,
        topic_tags:       doc.topicTags,
        readability_score: doc.readabilityScore,
        tokens_used:      doc.tokensUsed,
        created_at:       Math.floor(new Date(doc.createdAt).getTime() / 1000),
      }
    });
  } catch (err) {
    const traceId = span.spanContext().traceId;
    span.recordException(err);
    span.end();
    timer(undefined, { trace_id: traceId });
    errorsTotal.inc({ service: 'storage', reason: 'get_result_failed' });
    console.error('getResult error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { getResult };