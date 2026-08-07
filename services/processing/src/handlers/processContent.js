const { trace } = require('@opentelemetry/api');
const model = require('../gemini/client');
const { buildPrompt } = require('../gemini/prompt');
const { aiTokensTotal, processingDurationSeconds, errorsTotal } = require('../metrics');

const tracer = trace.getTracer('distill-processing');

async function processContent(call) {
  const { job_id, content } = call.request;
  const stageTimer = processingDurationSeconds.startTimer({ stage: 'PROCESS_STAGE_SUMMARIZING' });
  const rootSpan = tracer.startSpan('processing.process_content');
  rootSpan.setAttribute('job.id', job_id);
  const traceId = rootSpan.spanContext().traceId;

  try {
    // Emit stage update — summarizing started
    call.write({ job_id, stage: 'PROCESS_STAGE_SUMMARIZING' });

    const geminiSpan = tracer.startSpan('processing.gemini_call');
    geminiSpan.setAttribute('job.id', job_id);
    geminiSpan.setAttribute('model', model.modelName);
    geminiSpan.setAttribute('content_length', content ? content.length : 0);

    let result, text;
    try {
      if (process.env.MOCK_GEMINI === 'true') {
        text = JSON.stringify({
          summary: "This is a mock summary generated because MOCK_GEMINI is enabled.",
          keyEntities: ["Mock Entity 1", "Mock Entity 2"],
          qaPairs: [{ question: "What is this?", answer: "A mock response for testing." }],
          topicTags: ["Testing", "Mock"],
          readabilityScore: 85
        });
        result = { response: { text: () => text, usageMetadata: { totalTokenCount: 120 } } };
      } else {
        result = await model.generateContent(buildPrompt(content));
        text = result.response.text();
      }
      geminiSpan.end();
    } catch (gErr) {
      geminiSpan.recordException(gErr);
      geminiSpan.end();
      errorsTotal.inc({ service: 'processing', reason: 'gemini_api_error' });
      let friendlyMsg = gErr.message;
      if (gErr.message.includes('401') || gErr.message.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')) {
        friendlyMsg = 'Invalid Gemini API Key format. Google Gemini API keys start with "AIzaSy...". Please obtain an API key from Google AI Studio (https://aistudio.google.com/app/apikey) and place it in your .env file.';
      } else if (gErr.message.includes('403')) {
        friendlyMsg = 'Gemini API Key missing or unauthorized. Please set a valid GEMINI_API_KEY in your .env file.';
      }
      throw new Error(friendlyMsg);
    }

    // Stream a partial text chunk back
    call.write({
      job_id,
      stage:      'PROCESS_STAGE_SUMMARIZING',
      text_chunk: text.substring(0, 200),
    });

    const parseSpan = tracer.startSpan('processing.parse_response');
    parseSpan.setAttribute('job.id', job_id);

    // Parse Gemini's JSON response
    let parsed;
    try {
      // Strip markdown code fences if Gemini wraps in ```json ... ```
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      parseSpan.recordException(parseErr);
      parseSpan.end();
      errorsTotal.inc({ service: 'processing', reason: 'json_parse_error' });
      throw new Error(`Failed to parse Gemini response as JSON: ${parseErr.message}`);
    }

    const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
    parseSpan.setAttribute('tokens_used', tokensUsed);
    parseSpan.end();

    if (tokensUsed > 0) {
      aiTokensTotal.inc({ model: model.modelName }, tokensUsed);
    }

    stageTimer(undefined, { trace_id: traceId });
    rootSpan.end();

    call.write({
      job_id,
      stage: 'PROCESS_STAGE_COMPLETE',
      final_result: {
        summary:           parsed.summary           || '',
        key_entities:      parsed.keyEntities        || [],
        qa_pairs:          (parsed.qaPairs           || []).map(p => ({ question: p.question, answer: p.answer })),
        topic_tags:        parsed.topicTags          || [],
        readability_score: parsed.readabilityScore   || 0,
        tokens_used:       tokensUsed,
      },
    });

    call.end();
  } catch (err) {
    console.error('processContent error:', err.message);
    stageTimer(undefined, { trace_id: traceId });
    rootSpan.recordException(err);
    rootSpan.end();
    errorsTotal.inc({ service: 'processing', reason: 'process_content_failed' });
    call.write({
      job_id,
      stage: 'PROCESS_STAGE_FAILED',
      error: { code: 'PROCESSING_ERROR', message: err.message },
    });
    call.end();
  }
}

module.exports = { processContent };