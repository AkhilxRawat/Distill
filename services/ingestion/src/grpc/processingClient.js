const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
 
const pkgDef = protoLoader.loadSync(
  path.join(__dirname, '../../proto/processing.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
 
const proto = grpc.loadPackageDefinition(pkgDef).distill.processing.v1;
 
const host = `${process.env.PROCESSING_HOST || 'localhost'}:${process.env.PROCESSING_PORT || 50052}`;
 
module.exports = new proto.ProcessingService(host, grpc.credentials.createInsecure());
 