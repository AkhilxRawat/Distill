const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const grpc       = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const jwt        = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'distill-secret-change-me';

// ── Load protos ──────────────────────────────────────────────────────────────
function loadProto(file) {
  return protoLoader.loadSync(path.join(__dirname, '../proto', file), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  });
}

const ingestionProto = grpc.loadPackageDefinition(loadProto('ingestion.proto')).distill.ingestion.v1;
const storageProto   = grpc.loadPackageDefinition(loadProto('storage.proto')).distill.storage.v1;

const ingestionHost = `${process.env.INGESTION_HOST || 'localhost'}:${process.env.INGESTION_PORT || 50051}`;
const storageHost   = `${process.env.STORAGE_HOST   || 'localhost'}:${process.env.STORAGE_PORT   || 50053}`;

const ingestionClient = new ingestionProto.IngestionService(ingestionHost, grpc.credentials.createInsecure());
const storageClient   = new storageProto.StorageService(storageHost, grpc.credentials.createInsecure());

// ── Auth middleware ──────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Auth routes ──────────────────────────────────────────────────────────────
// Simple token issue — in production wire this to a real user store
app.post('/auth/token', (req, res) => {
  const { user_id, email } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const token = jwt.sign({ user_id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// ── Job routes ───────────────────────────────────────────────────────────────
// POST /jobs  — submit a new ingestion job
app.post('/jobs', authenticate, (req, res) => {
  const { source, source_type } = req.body;
  if (!source || !source_type) {
    return res.status(400).json({ error: 'source and source_type are required' });
  }

  ingestionClient.SubmitJob(
    { source, source_type, user_id: req.user.user_id },
    (err, response) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(202).json(response);
    }
  );
});

// GET /jobs/:jobId — poll job status
app.get('/jobs/:jobId', authenticate, (req, res) => {
  ingestionClient.GetJobStatus({ job_id: req.params.jobId }, (err, response) => {
    if (err) {
      if (err.code === 5) return res.status(404).json({ error: 'Job not found' });
      return res.status(500).json({ error: err.message });
    }
    res.json(response);
  });
});

// ── Result routes ─────────────────────────────────────────────────────────────
// GET /results — list all results for the authenticated user
app.get('/results', authenticate, (req, res) => {
  const page      = parseInt(req.query.page      || '1',  10);
  const page_size = parseInt(req.query.page_size || '10', 10);

  storageClient.ListResults(
    { user_id: req.user.user_id, page, page_size },
    (err, response) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(response);
    }
  );
});

// GET /results/:resultId — get a single result
app.get('/results/:resultId', authenticate, (req, res) => {
  storageClient.GetResult(
    { result_id: req.params.resultId, user_id: req.user.user_id },
    (err, response) => {
      if (err) {
        if (err.code === 5) return res.status(404).json({ error: 'Result not found' });
        return res.status(500).json({ error: err.message });
      }
      res.json(response.result);
    }
  );
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gateway running on :${PORT}`));