
const mongoose = require('mongoose');
 
const jobSchema = new mongoose.Schema({
  jobId:        { type: String, required: true, unique: true },
  userId:       { type: String, required: true },
  source:       { type: String, required: true },
  sourceType:   { type: String, enum: ['youtube_url', 'article_url', 'raw_text'] },
  status:       { type: String, enum: ['queued', 'fetching', 'processing', 'complete', 'failed'], default: 'queued' },
  errorMessage: { type: String, default: null },
}, { timestamps: true });
 
jobSchema.index({ userId: 1, createdAt: -1 });
 
module.exports = mongoose.model('Job', jobSchema);
 