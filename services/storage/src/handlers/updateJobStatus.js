const Job = require('../db/models/job');
 
async function updateJobStatus(call, callback) {
  const { job_id, status, error_message } = call.request;
 
  try {
    const update = { status };
    if (error_message) update.errorMessage = error_message;
 
    await Job.findOneAndUpdate(
      { jobId: job_id },
      update,
      { upsert: true, new: true }
    );
 
    callback(null, { success: true });
  } catch (err) {
    console.error('updateJobStatus error:', err.message);
    callback({ code: 13, message: err.message });
  }
}
 
module.exports = { updateJobStatus };
 