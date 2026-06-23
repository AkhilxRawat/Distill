'use strict';

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { ingestionClient } = require('../grpc/client');

const JWT_SECRET = process.env.JWT_SECRET || 'distill-secret-change-me';

/**
 * Attaches a WebSocket server to the existing HTTP server.
 * Clients connect to ws://<host>/ws/jobs and send:
 *   { type: 'subscribe', job_id: '<id>' }
 * The server polls job status and pushes updates until COMPLETE or FAILED.
 */
function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/jobs' });

  wss.on('connection', (ws, req) => {
    // Authenticate via ?token=<jwt> query param
    let user = null;
    try {
      const url    = new URL(req.url, 'http://localhost');
      const token  = url.searchParams.get('token');
      if (token) user = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(1008, 'Unauthorized');
      return;
    }

    if (!user) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const intervals = new Map(); // job_id -> intervalId

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'subscribe' && msg.job_id) {
        const { job_id } = msg;

        // Avoid duplicate subscriptions
        if (intervals.has(job_id)) return;

        const poll = setInterval(() => {
          ingestionClient.GetJobStatus({ job_id }, (err, response) => {
            if (err || ws.readyState !== ws.OPEN) {
              clearInterval(poll);
              intervals.delete(job_id);
              return;
            }

            const status = response.status;
            ws.send(JSON.stringify({ job_id, status }));

            if (status === 'JOB_STATUS_COMPLETE' || status === 'JOB_STATUS_FAILED') {
              clearInterval(poll);
              intervals.delete(job_id);
            }
          });
        }, 2000);

        intervals.set(job_id, poll);
      }

      if (msg.type === 'unsubscribe' && msg.job_id) {
        const poll = intervals.get(msg.job_id);
        if (poll) {
          clearInterval(poll);
          intervals.delete(msg.job_id);
        }
      }
    });

    ws.on('close', () => {
      // Clean up all polling intervals for this connection
      for (const [, poll] of intervals) clearInterval(poll);
      intervals.clear();
    });

    ws.on('error', (err) => {
      console.error('[ws] error:', err.message);
    });
  });

  console.log('[gateway] WebSocket server attached at /ws/jobs');
  return wss;
}

module.exports = { attachWebSocketServer };