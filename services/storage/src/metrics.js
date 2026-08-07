'use strict';

const express = require('express');
const client = require('prom-client');

client.register.setContentType(client.Registry.OPENMETRICS_CONTENT_TYPE);
client.collectDefaultMetrics({ prefix: 'distill_' });

const storageDurationSeconds = new client.Histogram({
  name: 'distill_storage_duration_seconds',
  help: 'Storage operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5],
  enableExemplars: true,
});

const errorsTotal = new client.Counter({
  name: 'distill_errors_total',
  help: 'Total errors by service and reason',
  labelNames: ['service', 'reason'],
});

const metricsPort = parseInt(process.env.METRICS_PORT || '9094', 10);
const metricsApp = express();

metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

metricsApp.listen(metricsPort, () => {
  console.log(`[storage] Prometheus metrics listening on :${metricsPort}`);
});

module.exports = {
  client,
  storageDurationSeconds,
  errorsTotal,
};
