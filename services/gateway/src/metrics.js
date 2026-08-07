'use strict';

const express = require('express');
const client = require('prom-client');

client.collectDefaultMetrics({ prefix: 'distill_' });

const submissionsTotal = new client.Counter({
  name: 'distill_submissions_total',
  help: 'Total job submissions',
  labelNames: ['source_type'],
});

const activeJobs = new client.Gauge({
  name: 'distill_active_jobs',
  help: 'Jobs currently being processed',
});

const errorsTotal = new client.Counter({
  name: 'distill_errors_total',
  help: 'Total errors by service and reason',
  labelNames: ['service', 'reason'],
});

const metricsPort = parseInt(process.env.METRICS_PORT || '9091', 10);
const metricsApp = express();

metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

metricsApp.listen(metricsPort, () => {
  console.log(`[gateway] Prometheus metrics listening on :${metricsPort}`);
});

module.exports = {
  client,
  submissionsTotal,
  activeJobs,
  errorsTotal,
};
