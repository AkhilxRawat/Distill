import { useState, useEffect } from 'react';

export function useJobStatus(jobId: string | null) {
  const [status, setStatus] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const baseURL = process.env.NEXT_PUBLIC_API_URL;

    // baseURL is baked in at build time, so its hostname (e.g. "localhost")
    // is wrong for anyone loading the page from a different machine. Keep
    // the port from the env var but derive the host from the page itself.
    let wsUrl;
    if (baseURL) {
      try {
        const url = new URL(baseURL);
        const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProto}//${window.location.hostname}:${url.port}/ws?token=${token}`;
      } catch (e) {
        wsUrl = `ws://${window.location.hostname}:3000/ws?token=${token}`;
      }
    } else {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${window.location.host}/ws?token=${token}`;
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', jobId }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'status') {
          // Map to the proto style status (e.g. JOB_STATUS_FETCHING) if it is in lowercase
          let s = msg.status;
          if (s === 'fetching') s = 'JOB_STATUS_FETCHING';
          if (s === 'processing') s = 'JOB_STATUS_PROCESSING';
          setStatus(s);
        }
        if (msg.type === 'partial') {
          setChunks(c => [...c, msg.chunk]);
        }
        if (msg.type === 'complete') {
          setStatus('JOB_STATUS_COMPLETE');
          setResultId(msg.resultId);
        }
        if (msg.type === 'error') {
          setStatus('JOB_STATUS_FAILED');
          setError(msg.message || 'Job failed');
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [jobId]);

  return { status, chunks, resultId, error };
}
