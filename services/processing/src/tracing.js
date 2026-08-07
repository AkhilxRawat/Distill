'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'distill-processing',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
      : 'http://tempo:4318/v1/traces',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new GrpcInstrumentation(),
  ],
});

sdk.start();
