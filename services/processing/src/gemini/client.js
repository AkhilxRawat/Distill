const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';
module.exports = genAI.getGenerativeModel({ model: modelName });
module.exports.modelName = modelName;