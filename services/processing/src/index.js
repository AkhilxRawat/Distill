const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { processContent } = require('./handlers/processContent');

const PROTO_PATH = path.join(__dirname, '../proto/processing.proto');
const pkgDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(pkgDef).distill.processing.v1;

const server = new grpc.Server();
server.addService(proto.ProcessingService.service, {
  ProcessContent: processContent,
});

server.bindAsync(
  '0.0.0.0:50052',
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) { console.error('Failed to bind processing server:', err); process.exit(1); }
    server.start();
    console.log(`Processing service running on :${port}`);
  }
);