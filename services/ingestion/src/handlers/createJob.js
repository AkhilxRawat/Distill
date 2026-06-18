const Job = require('../db/models/job');

async function createJob(call, callback) {
  const { job_id, user_id, source, source_type } = call.request;
  try {
    await Job.create({
      jobId:      job_id,
      userId:     user_id,
      source,
      sourceType: source_type,
      status:     'queued',
    });
    callback(null, { success: true });
  } catch (err) {
    callback({ code: 13, message: err.message });
  }
}

module.exports = { createJob };