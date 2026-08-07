'use strict';

const express = require('express');
const client = require('prom-client');

client.register.setContentType(client.Registry.OPENMETRICS_CONTENT_TYPE);
client.collectDefaultMetrics({ prefix: 'distill_' });

const fetchDurationSeconds = new client.Histogram({
  name: 'distill_fetch_duration_seconds',
  help: 'Content fetch duration in seconds',
  labelNames: ['source_type', 'status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
  enableExemplars: true,
});

const errorsTotal = new client.Counter({
  name: 'distill_errors_total',
  help: 'Total errors by service and reason',
  labelNames: ['service', 'reason'],
});

const metricsPort = parseInt(process.env.METRICS_PORT || '9092', 10);
const metricsApp = express();

metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

metricsApp.listen(metricsPort, () => {
  console.log(`[ingestion] Prometheus metrics listening on :${metricsPort}`);
});

module.exports = {
  client,
  fetchDurationSeconds,
  errorsTotal,
};
