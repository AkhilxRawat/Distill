const path   = require('path');
const grpc   = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');

const PROTO_DIR = path.join(__dirname, '../../proto');

const LOAD_OPTS = {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
};

function loadProto(filename) {
  return grpc.loadPackageDefinition(
    loader.loadSync(path.join(PROTO_DIR, filename), LOAD_OPTS)
  );
}

function makeClient(Proto, host) {
  return new Proto(host, grpc.credentials.createInsecure(), {
    'grpc.keepalive_time_ms':              10000,
    'grpc.keepalive_timeout_ms':           5000,
    'grpc.keepalive_permit_without_calls': 1,
  });
}

// ── Ingestion client ──────────────────────────────────────────────────────────
const ingestionPkg  = loadProto('ingestion.proto');
const IngestionSvc  = ingestionPkg.distill.ingestion.v1.IngestionService;
const ingestionHost = `${process.env.INGESTION_HOST || 'localhost'}:${process.env.INGESTION_PORT || 50051}`;
const ingestionClient = makeClient(IngestionSvc, ingestionHost);

// ── Storage client ────────────────────────────────────────────────────────────
const storagePkg  = loadProto('storage.proto');
const StorageSvc  = storagePkg.distill.storage.v1.StorageService;
const storageHost = `${process.env.STORAGE_HOST || 'localhost'}:${process.env.STORAGE_PORT || 50053}`;
const storageClient = makeClient(StorageSvc, storageHost);

module.exports = { ingestionClient, storageClient };