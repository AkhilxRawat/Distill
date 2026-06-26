import { useState, useEffect } from 'react';

export function useJobStatus(jobId: string | null) {
  const [status, setStatus] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    // Parse the host/port for WS connection
    let wsUrl = 'ws://localhost:3000/ws';
    try {
      const url = new URL(baseURL);
      const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${url.host}/ws?token=${token}`;
    } catch (e) {
      wsUrl = `ws://localhost:3000/ws?token=${token}`;
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
