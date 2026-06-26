'use strict';

const http    = require('http');
const express = require('express');
const cors    = require('cors');

const { apiLimiter }           = require('./middleware/rateLimiter');
const { errorHandler }         = require('./middleware/errors');
const { attachWebSocketServer, publishStatusUpdate } = require('./ws/jobStream');

const authRoutes    = require('./routes/auth');
const jobRoutes     = require('./routes/jobs');
const resultRoutes  = require('./routes/results');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

app.set('trust proxy', 1); // trust X-Forwarded-For from load balancers

app.use(cors({
  origin:  process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '512kb' }));

// Global API rate limiter (auth routes have their own stricter limiter)
app.use('/api', apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/internal/jobs/:jobId/status', (req, res) => {
  const { jobId } = req.params;
  publishStatusUpdate(jobId, req.body);
  res.sendStatus(200);
});

app.use('/auth',         authRoutes);
app.use('/jobs',         jobRoutes);
app.use('/results',      resultRoutes);

// Backward-compat aliases with /api prefix
app.use('/api/auth',     authRoutes);
app.use('/api/jobs',     jobRoutes);
app.use('/api/results',  resultRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

// ── Centralised error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const PORT   = parseInt(process.env.PORT || '3000', 10);
const server = http.createServer(app);

attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[gateway] HTTP  listening on :${PORT}`);
  console.log(`[gateway] WS    listening on ws://localhost:${PORT}/ws/jobs`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`[gateway] received ${signal}, shutting down…`);
  server.close(() => {
    console.log('[gateway] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000); // force-exit after 10 s
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));