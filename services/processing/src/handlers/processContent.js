const model = require('../gemini/client');
const { buildPrompt } = require('../gemini/prompt');

async function processContent(call) {
  const { job_id, content } = call.request;

  try {
    // Emit stage update — summarizing started
    call.write({ job_id, stage: 'PROCESS_STAGE_SUMMARIZING' });

    const result = await model.generateContent(buildPrompt(content));
    const text   = result.response.text();

    // Stream a partial text chunk back
    call.write({
      job_id,
      stage:      'PROCESS_STAGE_SUMMARIZING',
      text_chunk: text.substring(0, 200),
    });

    // Parse Gemini's JSON response
    let parsed;
    try {
      // Strip markdown code fences if Gemini wraps in ```json ... ```
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      throw new Error(`Failed to parse Gemini response as JSON: ${parseErr.message}`);
    }

    call.write({
      job_id,
      stage: 'PROCESS_STAGE_COMPLETE',
      final_result: {
        summary:           parsed.summary           || '',
        key_entities:      parsed.keyEntities        || [],
        qa_pairs:          (parsed.qaPairs           || []).map(p => ({ question: p.question, answer: p.answer })),
        topic_tags:        parsed.topicTags          || [],
        readability_score: parsed.readabilityScore   || 0,
        tokens_used:       result.response.usageMetadata?.totalTokenCount || 0,
      },
    });

    call.end();
  } catch (err) {
    console.error('processContent error:', err.message);
    call.write({
      job_id,
      stage: 'PROCESS_STAGE_FAILED',
      error: { code: 'PROCESSING_ERROR', message: err.message },
    });
    call.end();
  }
}

module.exports = { processContent };