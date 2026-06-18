const { v4: uuidv4 } = require('uuid');
const Result = require('../db/models/result');
const Job    = require('../db/models/job');

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

  try {
    const result_id = uuidv4();

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

    // Mark the job as complete
    await Job.findOneAndUpdate(
      { jobId: job_id },
      { status: 'complete' },
      { new: true }
    );

    callback(null, { result_id });
  } catch (err) {
    console.error('saveResult error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { saveResult };