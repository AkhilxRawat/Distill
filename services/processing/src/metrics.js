'use strict';

const express = require('express');
const client = require('prom-client');

client.register.setContentType(client.Registry.OPENMETRICS_CONTENT_TYPE);
client.collectDefaultMetrics({ prefix: 'distill_' });

const aiTokensTotal = new client.Counter({
  name: 'distill_ai_tokens_total',
  help: 'Total Gemini AI tokens consumed',
  labelNames: ['model'],
});

const processingDurationSeconds = new client.Histogram({
  name: 'distill_processing_duration_seconds',
  help: 'Processing stage duration in seconds',
  labelNames: ['stage'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
  enableExemplars: true,
});

const errorsTotal = new client.Counter({
  name: 'distill_errors_total',
  help: 'Total errors by service and reason',
  labelNames: ['service', 'reason'],
});

const metricsPort = parseInt(process.env.METRICS_PORT || '9093', 10);
const metricsApp = express();

metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

metricsApp.listen(metricsPort, () => {
  console.log(`[processing] Prometheus metrics listening on :${metricsPort}`);
});

module.exports = {
  client,
  aiTokensTotal,
  processingDurationSeconds,
  errorsTotal,
};
