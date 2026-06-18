const Job = require('../db/models/job');

async function getJobStatus(call, callback) {
  const { job_id } = call.request;

  try {
    const doc = await Job.findOne({ jobId: job_id });

    if (!doc) {
      return callback({ code: 5, message: 'Job not found' });
    }

    // Map mongoose status string → proto enum string
    const statusMap = {
      queued:     'JOB_STATUS_QUEUED',
      fetching:   'JOB_STATUS_FETCHING',
      processing: 'JOB_STATUS_PROCESSING',
      complete:   'JOB_STATUS_COMPLETE',
      failed:     'JOB_STATUS_FAILED',
    };

    callback(null, {
      job_id:        doc.jobId,
      status:        statusMap[doc.status] || 'JOB_STATUS_UNSPECIFIED',
      error_message: doc.errorMessage || '',
      created_at:    Math.floor(new Date(doc.createdAt).getTime() / 1000),
      updated_at:    Math.floor(new Date(doc.updatedAt).getTime() / 1000),
    });
  } catch (err) {
    console.error('getJobStatus error:', err.message);
    callback({ code: 13, message: err.message });
  }
}

module.exports = { getJobStatus };