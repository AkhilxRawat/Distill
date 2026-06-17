const { v4: uuidv4 } = require('uuid');
const { fetchYoutubeTranscript } = require('../fetchers/youtube');
const { fetchArticle } = require('../fetchers/article');
const { fetchRawText } = require('../fetchers/rawText');
const storageClient = require('../grpc/storageClient');
const processingClient = require('../grpc/processingClient');

async function submitJob(call, callback) {
  const { source, source_type, user_id } = call.request;
  const job_id = uuidv4();

  // 1. Mark job as QUEUED in storage
  await updateStatus(job_id, 'queued');

  callback(null, { job_id, status: 'JOB_STATUS_QUEUED' });

  // 2. Fetch content asynchronously
  try {
    await updateStatus(job_id, 'fetching');
    let content;
    if (source_type === 'SOURCE_TYPE_YOUTUBE_URL') content = await fetchYoutubeTranscript(source);
    else if (source_type === 'SOURCE_TYPE_ARTICLE_URL') content = await fetchArticle(source);
    else content = await fetchRawText(source);

    // 3. Send to processing
    await updateStatus(job_id, 'processing');
    triggerProcessing(job_id, user_id, content, source_type, source);
  } catch (err) {
    await updateStatus(job_id, 'failed', err.message);
  }
}

function updateStatus(job_id, status, error_message = '') {
  return new Promise((res, rej) => {
    storageClient.UpdateJobStatus({ job_id, status, error_message }, (err) => err ? rej(err) : res());
  });
}

function triggerProcessing(job_id, user_id, content, source_type, source) {
  const stream = processingClient.ProcessContent({ job_id, user_id, content, source_type });
  stream.on('data', (response) => {
    if (response.stage === 'PROCESS_STAGE_COMPLETE' && response.final_result) {
      const r = response.final_result;
      storageClient.SaveResult({ job_id, user_id, source, source_type, ...r,
        key_entities: r.key_entities, qa_pairs: r.qa_pairs, topic_tags: r.topic_tags
      }, () => {});
    }
  });
  stream.on('error', (err) => updateStatus(job_id, 'failed', err.message));
}

module.exports = { submitJob };