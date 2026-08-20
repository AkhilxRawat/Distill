const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const modelName = process.env.CLAUDE_MODEL || 'claude-opus-5';

module.exports = { client, modelName };
