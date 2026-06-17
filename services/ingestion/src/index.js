const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { submitJob } = require('./handlers/submitJob');
const { getJobStatus } = require('./handlers/getJobStatus');

const PROTO_PATH = path.join(__dirname, '../../proto/ingestion.proto');
const pkgDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const proto = grpc.loadPackageDefinition(pkgDef).distill.ingestion.v1;

const server = new grpc.Server();
server.addService(proto.IngestionService.service, { SubmitJob: submitJob, GetJobStatus: getJobStatus });
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => server.start());
console.log('Ingestion service running on :50051');