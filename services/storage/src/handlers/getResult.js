const Result = require('../db/models/result');
 
async function getResult(call, callback) {
  const { result_id, user_id } = call.request;
 
  try {
    const doc = await Result.findOne({ resultId: result_id, userId: user_id });
 
    if (!doc) {
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
    console.error('getResult error:', err.message);
    callback({ code: 13, message: err.message });
  }
}
 
module.exports = { getResult };