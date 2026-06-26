const Job = require('../db/models/job');

async function updateJobStatus(call, callback) {
  const { job_id, status, error_message } = call.request;
  try {
    const job = await Job.findOneAndUpdate(
      { jobId: job_id },
      { status, ...(error_message && { errorMessage: error_message }) },
      { new: true }
    );
    if (!job) return callback({ code: 5, message: `Job ${job_id} not found` });
    callback(null, { success: true });
  } catch (err) {
    console.error('updateJobStatus error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { updateJobStatus }; 