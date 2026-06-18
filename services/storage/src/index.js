const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { connect } = require('./db/connection');

const { saveResult }      = require('./handlers/saveResult');
const { getResult }       = require('./handlers/getResult');
const { listResults }     = require('./handlers/listResults');
const { updateJobStatus } = require('./handlers/updateJobStatus');
const { getJobStatus }    = require('./handlers/getJobStatus');

const PROTO_PATH = path.join(__dirname, '../../proto/storage.proto');

const pkgDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(pkgDef).distill.storage.v1;

async function main() {
  await connect();

  const server = new grpc.Server();

  server.addService(proto.StorageService.service, {
    SaveResult:      saveResult,
    GetResult:       getResult,
    ListResults:     listResults,
    UpdateJobStatus: updateJobStatus,
    GetJobStatus:    getJobStatus,
  });

  server.bindAsync(
    '0.0.0.0:50053',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) { console.error('Failed to bind storage server:', err); process.exit(1); }
      server.start();
      console.log(`Storage service running on :${port}`);
    }
  );
}

main().catch(err => {
  console.error('Storage service startup failed:', err);
  process.exit(1);
});