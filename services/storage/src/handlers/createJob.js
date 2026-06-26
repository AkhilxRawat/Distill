const Job = require('../db/models/job');

async function createJob(call, callback) {
  const { job_id, user_id, source, source_type } = call.request;

  const map = {
    'SOURCE_TYPE_YOUTUBE_URL': 'youtube_url',
    'SOURCE_TYPE_ARTICLE_URL': 'article_url',
    'SOURCE_TYPE_RAW_TEXT':    'raw_text',
    'youtube_url':             'youtube_url',
    'article_url':             'article_url',
    'raw_text':                'raw_text',
  };
  const mappedSourceType = map[source_type] || 'raw_text';

  try {
    await Job.create({
      jobId:      job_id,
      userId:     user_id,
      source,
      sourceType: mappedSourceType,
      status:     'queued',
    });
    callback(null, { success: true });
  } catch (err) {
    console.error('createJob error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { createJob };
