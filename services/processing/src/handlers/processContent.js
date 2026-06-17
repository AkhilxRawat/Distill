async function processContent(call) {
const { job_id, user_id, content, source_type } = call.request;
try {
// Emit stage update
call.write({ job_id, stage: 'PROCESS_STAGE_SUMMARIZING' });
const result = await model.generateContent(buildPrompt(content));
const text = result.response.text();
// Stream partial text back as it arrives (simplified — full streaming uses 
generateContentStream)
call.write({ job_id, stage: 'PROCESS_STAGE_SUMMARIZING', text_chunk: 
text.substring(0, 200) });
const parsed = JSON.parse(text);
call.write({
job_id,
stage: 'PROCESS_STAGE_COMPLETE',
final_result: {
summary: parsed.summary,
key_entities: parsed.keyEntities,
qa_pairs: parsed.qaPairs,
topic_tags: parsed.topicTags,
readability_score: parsed.readabilityScore,
tokens_used: result.response.usageMetadata?.totalTokenCount || 0,
}
});
call.end();
} catch (err) {
call.write({ job_id, stage: 'PROCESS_STAGE_FAILED', error: { code: 
'PROCESSING_ERROR', message: err.message } });
call.end();
}
}