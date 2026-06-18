const storageClient = require('../grpc/storageClient');

async function getJobStatus(call, callback) {
  const { job_id } = call.request;

  storageClient.GetJobStatus({ job_id }, (err, response) => {
    if (err) {
      return callback({ code: 13, message: err.message });
    }
    callback(null, {
      job_id:        response.job_id,
      status:        response.status,
      error_message: response.error_message || '',
      created_at:    response.created_at,
      updated_at:    response.updated_at,
    });
  });
}

module.exports = { getJobStatus };