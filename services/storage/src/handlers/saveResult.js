const { v4: uuidv4 } = require('uuid');
const { trace } = require('@opentelemetry/api');
const Result = require('../db/models/result');
const Job    = require('../db/models/job');
const { storageDurationSeconds, errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-storage');

async function saveResult(call, callback) {
  const {
    job_id,
    user_id,
    source,
    source_type,
    summary,
    key_entities,
    qa_pairs,
    topic_tags,
    readability_score,
    tokens_used,
  } = call.request;

  const timer = storageDurationSeconds.startTimer({ operation: 'save_result' });
  const span = tracer.startSpan('storage.save_result');
  const result_id = uuidv4();
  span.setAttribute('job.id', job_id);
  span.setAttribute('result_id', result_id);

  try {
    const qSpan = tracer.startSpan('storage.query');
    qSpan.setAttribute('collection', 'results');
    qSpan.setAttribute('operation', 'create');

    await Result.create({
      resultId:         result_id,
      jobId:            job_id,
      userId:           user_id,
      source,
      sourceType:       source_type,
      summary,
      keyEntities:      key_entities  || [],
      qaPairs:          qa_pairs      || [],
      topicTags:        topic_tags    || [],
      readabilityScore: readability_score || 0,
      tokensUsed:       tokens_used   || 0,
    });
    qSpan.end();

    const jobqSpan = tracer.startSpan('storage.query');
    jobqSpan.setAttribute('collection', 'jobs');
    jobqSpan.setAttribute('operation', 'findOneAndUpdate');

    // Mark the job as complete
    await Job.findOneAndUpdate(
      { jobId: job_id },
      { status: 'complete' },
      { new: true }
    );
    jobqSpan.end();

    const traceId = span.spanContext().traceId;
    timer(undefined, { trace_id: traceId });
    span.end();
    callback(null, { result_id });
  } catch (err) {
    const traceId = span.spanContext().traceId;
    timer(undefined, { trace_id: traceId });
    span.recordException(err);
    span.end();
    errorsTotal.inc({ service: 'storage', reason: 'save_result_failed' });
    console.error('saveResult error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { saveResult };