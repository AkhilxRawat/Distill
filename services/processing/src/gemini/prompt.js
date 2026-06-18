function buildPrompt(content) {
  return `You are an expert content analyst. Analyze the following content and return a JSON object with these exact fields:
- summary: a concise 3-5 sentence summary
- keyEntities: array of up to 8 important people, places, organizations, or concepts
- qaPairs: array of 3-5 objects with "question" and "answer" fields
- topicTags: array of 3-6 short topic tags
- readabilityScore: integer 0-100 (100 = very easy to read)

Content:
${content}

Return only valid JSON. No markdown, no explanation outside the JSON.`;
}

module.exports = { buildPrompt };