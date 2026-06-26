'use strict';

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'distill-secret-change-me';

// Map: jobId -> Set of WebSocket client connections
const activeSubscriptions = new Map();

function attachWebSocketServer(httpServer) {
  // Mount on /ws path to match client
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Authenticate via ?token=<jwt> query param
    let user = null;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        user = jwt.verify(token, JWT_SECRET);
      }
    } catch (err) {
      console.warn('[ws] Auth failed:', err.message);
      ws.close(1008, 'Unauthorized');
      return;
    }

    if (!user) {
      console.warn('[ws] No user authenticated');
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Keep track of jobIds subscribed on this connection for cleanup
    const subscribedJobs = new Set();

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      // Handle "subscribe" message
      if (msg.type === 'subscribe' && msg.jobId) {
        const { jobId } = msg;

        subscribedJobs.add(jobId);

        if (!activeSubscriptions.has(jobId)) {
          activeSubscriptions.set(jobId, new Set());
        }
        activeSubscriptions.get(jobId).add(ws);
      }

      // Handle "unsubscribe" message
      if (msg.type === 'unsubscribe' && msg.jobId) {
        const { jobId } = msg;
        subscribedJobs.delete(jobId);

        const subs = activeSubscriptions.get(jobId);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) {
            activeSubscriptions.delete(jobId);
          }
        }
      }
    });

    ws.on('close', () => {
      // Clean up all subscriptions for this connection
      for (const jobId of subscribedJobs) {
        const subs = activeSubscriptions.get(jobId);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) {
            activeSubscriptions.delete(jobId);
          }
        }
      }
      subscribedJobs.clear();
    });

    ws.on('error', (err) => {
      console.error('[ws] error:', err.message);
    });
  });

  console.log('[gateway] WebSocket server attached at /ws');
  return wss;
}

/**
 * Publishes a status update to all clients subscribed to a specific jobId.
 * @param {string} jobId
 * @param {object} event
 */
function publishStatusUpdate(jobId, event) {
  const subs = activeSubscriptions.get(jobId);
  if (subs) {
    const payload = JSON.stringify({ jobId, ...event });
    for (const ws of subs) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
}

module.exports = {
  attachWebSocketServer,
  publishStatusUpdate,
};