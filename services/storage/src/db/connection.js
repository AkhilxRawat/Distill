const mongoose = require('mongoose');
async function connect() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/distill');
  console.log('MongoDB connected');
}
module.exports = { connect };