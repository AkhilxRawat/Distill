const Result = require('../db/models/result');

async function listResults(call, callback) {
  const { user_id, page = 1, page_size = 10 } = call.request;

  try {
    const skip  = (page - 1) * page_size;
    const total = await Result.countDocuments({ userId: user_id });
    const docs  = await Result.find({ userId: user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(page_size);

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
    console.error('listResults error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { listResults };