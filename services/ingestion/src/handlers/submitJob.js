const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { trace } = require('@opentelemetry/api');
const { fetchYoutubeTranscript } = require('../fetchers/youtube');
const { fetchArticle }           = require('../fetchers/article');
const { fetchRawText }           = require('../fetchers/rawText');
const storageClient              = require('../grpc/storageClient');
const processingClient           = require('../grpc/processingClient');
const { fetchDurationSeconds, errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-ingestion');
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000';

async function submitJob(call, callback) {
  const { source, source_type, user_id } = call.request;
  const job_id = uuidv4();

  try {
    await createJob(job_id, user_id, source, source_type);
  } catch (err) {
    errorsTotal.inc({ service: 'ingestion', reason: 'create_job_failed' });
    return callback({ code: 13, message: `Failed to create job: ${err.message}` });
  }

  callback(null, { job_id, status: 'JOB_STATUS_QUEUED' });

  runPipeline(job_id, user_id, source, source_type);
}

function createJob(job_id, user_id, source, source_type) {
  return new Promise((res, rej) => {
    storageClient.CreateJob({ job_id, user_id, source, source_type }, (err) => {
      if (err) return rej(err);
      res();
    });
  });
}

function setStatus(job_id, status, error_message = '') {
  return new Promise((res, rej) => {
    storageClient.UpdateJobStatus({ job_id, status, error_message }, (err) => {
      if (err) return rej(err);
      res();
    });
  });
}

async function notifyGateway(job_id, event) {
  try {
    await axios.post(`${GATEWAY_URL}/internal/jobs/${job_id}/status`, event);
  } catch (err) {
    console.error(`Failed to notify gateway for job ${job_id}:`, err.message);
  }
}

async function runPipeline(job_id, user_id, source, source_type) {
  try {
    await setStatus(job_id, 'fetching');
    await notifyGateway(job_id, { type: 'status', status: 'fetching' });

    const fetchTimer = fetchDurationSeconds.startTimer({ source_type: source_type || 'SOURCE_TYPE_UNSPECIFIED' });
    let content;
    let fetchSpan;

    if (source_type === 'SOURCE_TYPE_YOUTUBE_URL') {
      fetchSpan = tracer.startSpan('ingestion.fetch_youtube');
      fetchSpan.setAttribute('job.id', job_id);
      fetchSpan.setAttribute('url', source);
      try {
        content = await fetchYoutubeTranscript(source);
        fetchTimer({ status: 'success' }, { trace_id: fetchSpan.spanContext().traceId });
        fetchSpan.end();
      } catch (err) {
        fetchTimer({ status: 'error' }, { trace_id: fetchSpan.spanContext().traceId });
        fetchSpan.recordException(err);
        fetchSpan.end();
        errorsTotal.inc({ service: 'ingestion', reason: 'youtube_fetch_failed' });
        throw err;
      }
    } else if (source_type === 'SOURCE_TYPE_ARTICLE_URL') {
      fetchSpan = tracer.startSpan('ingestion.fetch_article');
      fetchSpan.setAttribute('job.id', job_id);
      fetchSpan.setAttribute('url', source);
      try {
        content = await fetchArticle(source);
        fetchTimer({ status: 'success' }, { trace_id: fetchSpan.spanContext().traceId });
        fetchSpan.end();
      } catch (err) {
        fetchTimer({ status: 'error' }, { trace_id: fetchSpan.spanContext().traceId });
        fetchSpan.recordException(err);
        fetchSpan.end();
        errorsTotal.inc({ service: 'ingestion', reason: 'article_fetch_failed' });
        throw err;
      }
    } else {
      fetchSpan = tracer.startSpan('ingestion.fetch_raw_text');
      fetchSpan.setAttribute('job.id', job_id);
      content = await fetchRawText(source);
      fetchTimer({ status: 'success' }, { trace_id: fetchSpan.spanContext().traceId });
      fetchSpan.end();
    }

    await setStatus(job_id, 'processing');
    await notifyGateway(job_id, { type: 'status', status: 'processing' });

    triggerProcessing(job_id, user_id, content, source_type, source);

  } catch (err) {
    console.error(`Pipeline error for job ${job_id}:`, err.message);
    await setStatus(job_id, 'failed', err.message);
    await notifyGateway(job_id, { type: 'error', message: err.message });
  }
}

function triggerProcessing(job_id, user_id, content, source_type, source) {
  const stream = processingClient.ProcessContent({ job_id, user_id, content, source_type });

  stream.on('data', (response) => {
    if (response.text_chunk) {
      notifyGateway(job_id, { type: 'partial', chunk: response.text_chunk });
    }

    if (response.stage === 'PROCESS_STAGE_COMPLETE' && response.final_result) {
      const r = response.final_result;
      storageClient.SaveResult({
        job_id, user_id, source, source_type,
        summary:           r.summary,
        key_entities:      r.key_entities,
        qa_pairs:          r.qa_pairs,
        topic_tags:        r.topic_tags,
        readability_score: r.readability_score,
        tokens_used:       r.tokens_used,
      }, (err, resData) => {
        if (err) {
          console.error(`SaveResult failed for job ${job_id}:`, err.message);
          errorsTotal.inc({ service: 'ingestion', reason: 'save_result_failed' });
          setStatus(job_id, 'failed', err.message).catch(console.error);
          notifyGateway(job_id, { type: 'error', message: err.message });
        } else {
          notifyGateway(job_id, { type: 'complete', resultId: resData.result_id });
        }
      });
    }

    if (response.stage === 'PROCESS_STAGE_FAILED') {
      const msg = response.error?.message || 'Processing failed';
      errorsTotal.inc({ service: 'ingestion', reason: 'processing_stage_failed' });
      setStatus(job_id, 'failed', msg).catch(console.error);
      notifyGateway(job_id, { type: 'error', message: msg });
    }
  });

  stream.on('error', (err) => {
    console.error(`Processing stream error for job ${job_id}:`, err.message);
    errorsTotal.inc({ service: 'ingestion', reason: 'processing_stream_error' });
    setStatus(job_id, 'failed', err.message).catch(console.error);
    notifyGateway(job_id, { type: 'error', message: err.message });
  });
}

module.exports = { submitJob };
