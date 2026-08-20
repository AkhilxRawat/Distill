const { trace } = require('@opentelemetry/api');
const { client, modelName } = require('../claude/client');
const { buildPrompt } = require('../claude/prompt');
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

    const claudeSpan = tracer.startSpan('processing.claude_call');
    claudeSpan.setAttribute('job.id', job_id);
    claudeSpan.setAttribute('model', modelName);
    claudeSpan.setAttribute('content_length', content ? content.length : 0);

    let text, tokensUsed;
    try {
      if (process.env.MOCK_CLAUDE === 'true') {
        text = JSON.stringify({
          summary: "This is a mock summary generated because MOCK_CLAUDE is enabled.",
          keyEntities: ["Mock Entity 1", "Mock Entity 2"],
          qaPairs: [{ question: "What is this?", answer: "A mock response for testing." }],
          topicTags: ["Testing", "Mock"],
          readabilityScore: 85
        });
        tokensUsed = 120;
      } else {
        const message = await client.messages.create({
          model: modelName,
          max_tokens: 4096,
          messages: [{ role: 'user', content: buildPrompt(content) }],
        });
        text = message.content.find(block => block.type === 'text')?.text || '';
        tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
      }
      claudeSpan.end();
    } catch (cErr) {
      claudeSpan.recordException(cErr);
      claudeSpan.end();
      errorsTotal.inc({ service: 'processing', reason: 'claude_api_error' });
      let friendlyMsg = cErr.message;
      if (cErr.status === 401) {
        friendlyMsg = 'Invalid Claude API key. Obtain one from the Anthropic Console (https://console.anthropic.com/settings/keys) and set ANTHROPIC_API_KEY in your .env file.';
      } else if (cErr.status === 403) {
        friendlyMsg = 'Claude API key missing or unauthorized. Please set a valid ANTHROPIC_API_KEY in your .env file.';
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

    // Parse Claude's JSON response
    let parsed;
    try {
      // Strip markdown code fences if Claude wraps in ```json ... ```
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      parseSpan.recordException(parseErr);
      parseSpan.end();
      errorsTotal.inc({ service: 'processing', reason: 'json_parse_error' });
      throw new Error(`Failed to parse Claude response as JSON: ${parseErr.message}`);
    }

    parseSpan.setAttribute('tokens_used', tokensUsed);
    parseSpan.end();

    if (tokensUsed > 0) {
      aiTokensTotal.inc({ model: modelName }, tokensUsed);
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