const { v4: uuidv4 } = require('uuid');
const { fetchYoutubeTranscript } = require('../fetchers/youtube');
const { fetchArticle }           = require('../fetchers/article');
const { fetchRawText }           = require('../fetchers/rawText');
const storageClient              = require('../grpc/storageClient');
const processingClient           = require('../grpc/processingClient');

async function submitJob(call, callback) {
  const { source, source_type, user_id } = call.request;
  const job_id = uuidv4();

  // 1. Create job as QUEUED in storage
  try {
    await updateStatus(job_id, user_id, source, source_type, 'queued');
  } catch (err) {
    return callback({ code: 13, message: `Failed to create job: ${err.message}` });
  }

  // 2. Return immediately so the caller isn't blocked
  callback(null, { job_id, status: 'JOB_STATUS_QUEUED' });

  // 3. Run the rest of the pipeline asynchronously
  runPipeline(job_id, user_id, source, source_type);
}

async function runPipeline(job_id, user_id, source, source_type) {
  try {
    // Fetch content
    await setStatus(job_id, 'fetching');
    let content;

    if (source_type === 'SOURCE_TYPE_YOUTUBE_URL') {
      content = await fetchYoutubeTranscript(source);
    } else if (source_type === 'SOURCE_TYPE_ARTICLE_URL') {
      content = await fetchArticle(source);
    } else {
      content = await fetchRawText(source);
    }

    // Hand off to processing
    await setStatus(job_id, 'processing');
    triggerProcessing(job_id, user_id, content, source_type, source);

  } catch (err) {
    console.error(`Pipeline error for job ${job_id}:`, err.message);
    await setStatus(job_id, 'failed', err.message);
  }
}

// Create the job record in storage (upsert so UpdateJobStatus works)
function updateStatus(job_id, user_id, source, source_type, status) {
  return new Promise((res, rej) => {
    storageClient.UpdateJobStatus(
      { job_id, status, error_message: '' },
      (err) => {
        if (err) return rej(err);
        res();
      }
    );
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

function triggerProcessing(job_id, user_id, content, source_type, source) {
  const stream = processingClient.ProcessContent({ job_id, user_id, content, source_type });

  stream.on('data', (response) => {
    if (response.stage === 'PROCESS_STAGE_COMPLETE' && response.final_result) {
      const r = response.final_result;
      storageClient.SaveResult({
        job_id,
        user_id,
        source,
        source_type,
        summary:           r.summary,
        key_entities:      r.key_entities,
        qa_pairs:          r.qa_pairs,
        topic_tags:        r.topic_tags,
        readability_score: r.readability_score,
        tokens_used:       r.tokens_used,
      }, (err) => {
        if (err) console.error(`SaveResult failed for job ${job_id}:`, err.message);
      });
    }

    if (response.stage === 'PROCESS_STAGE_FAILED') {
      const msg = response.error?.message || 'Processing failed';
      setStatus(job_id, 'failed', msg).catch(console.error);
    }
  });

  stream.on('error', (err) => {
    console.error(`Processing stream error for job ${job_id}:`, err.message);
    setStatus(job_id, 'failed', err.message).catch(console.error);
  });
}

module.exports = { submitJob };