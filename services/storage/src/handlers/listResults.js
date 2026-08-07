const { trace } = require('@opentelemetry/api');
const Result = require('../db/models/result');
const { storageDurationSeconds, errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-storage');

async function listResults(call, callback) {
  const user_id = call.request.user_id;
  const page = call.request.page || 1;
  const page_size = call.request.page_size || 10;
  const timer = storageDurationSeconds.startTimer({ operation: 'list_results' });
  const span = tracer.startSpan('storage.query');
  span.setAttribute('collection', 'results');
  span.setAttribute('operation', 'find');

  try {
    const skip  = (page - 1) * page_size;
    const total = await Result.countDocuments({ userId: user_id });
    const docs  = await Result.find({ userId: user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(page_size);

    const traceId = span.spanContext().traceId;
    span.end();
    timer(undefined, { trace_id: traceId });

    const results = docs.map(doc => ({
      result_id:         doc.resultId,
      job_id:            doc.jobId,
      user_id:           doc.userId,
      source:            doc.source,
      source_type:       doc.sourceType,
      summary:           doc.summary,
      key_entities:      doc.keyEntities,
      qa_pairs:          doc.qaPairs,
      topic_tags:        doc.topicTags,
      readability_score: doc.readabilityScore,
      tokens_used:       doc.tokensUsed,
      created_at:        Math.floor(new Date(doc.createdAt).getTime() / 1000),
    }));

    callback(null, { results, total });
  } catch (err) {
    const traceId = span.spanContext().traceId;
    span.recordException(err);
    span.end();
    timer(undefined, { trace_id: traceId });
    errorsTotal.inc({ service: 'storage', reason: 'list_results_failed' });
    console.error('listResults error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { listResults };