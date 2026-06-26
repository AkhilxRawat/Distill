const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { fetchYoutubeTranscript } = require('../fetchers/youtube');
const { fetchArticle }           = require('../fetchers/article');
const { fetchRawText }           = require('../fetchers/rawText');
const storageClient              = require('../grpc/storageClient');
const processingClient           = require('../grpc/processingClient');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000';

async function submitJob(call, callback) {
  const { source, source_type, user_id } = call.request;
  const job_id = uuidv4();

  try {
    await createJob(job_id, user_id, source, source_type);
  } catch (err) {
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

    let content;
    if (source_type === 'SOURCE_TYPE_YOUTUBE_URL') {
      content = await fetchYoutubeTranscript(source);
    } else if (source_type === 'SOURCE_TYPE_ARTICLE_URL') {
      content = await fetchArticle(source);
    } else {
      content = await fetchRawText(source);
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
          setStatus(job_id, 'failed', err.message).catch(console.error);
          notifyGateway(job_id, { type: 'error', message: err.message });
        } else {
          notifyGateway(job_id, { type: 'complete', resultId: resData.result_id });
        }
      });
    }

    if (response.stage === 'PROCESS_STAGE_FAILED') {
      const msg = response.error?.message || 'Processing failed';
      setStatus(job_id, 'failed', msg).catch(console.error);
      notifyGateway(job_id, { type: 'error', message: msg });
    }
  });

  stream.on('error', (err) => {
    console.error(`Processing stream error for job ${job_id}:`, err.message);
    setStatus(job_id, 'failed', err.message).catch(console.error);
    notifyGateway(job_id, { type: 'error', message: err.message });
  });
}

module.exports = { submitJob };
