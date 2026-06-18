
const mongoose = require('mongoose');
 
const resultSchema = new mongoose.Schema({
  resultId:         { type: String, required: true, unique: true },
  jobId:            { type: String, required: true, unique: true },
  userId:           { type: String, required: true },
  source:           String,
  sourceType:       String,
  summary:          String,
  keyEntities:      [String],
  qaPairs:          [{ question: String, answer: String }],
  topicTags:        [String],
  readabilityScore: Number,
  tokensUsed:       Number,
}, { timestamps: true });
 
resultSchema.index({ userId: 1, createdAt: -1 });
resultSchema.index({ topicTags: 1 });
 
module.exports = mongoose.model('Result', resultSchema);
 