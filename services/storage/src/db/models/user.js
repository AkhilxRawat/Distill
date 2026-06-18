const mongoose = require('mongoose');
 
const userSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  lastLoginAt:  Date,
}, { timestamps: true });
 
module.exports = mongoose.model('User', userSchema);
 