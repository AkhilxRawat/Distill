// src/grpc/storageClient.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const pkgDef = protoLoader.loadSync(path.join(__dirname, '../../../proto/storage.proto'), { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const proto = grpc.loadPackageDefinition(pkgDef).distill.storage.v1;
const host = `${process.env.STORAGE_HOST || 'localhost'}:${process.env.STORAGE_PORT || 50053}`;
module.exports = new proto.StorageService(host, grpc.credentials.createInsecure());