'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { jobs, results } from '@/lib/api';
import Navbar from '@/components/Navbar';
import StatusBadge from '@/components/StatusBadge';

const SOURCE_TYPES = [
  { value: 'SOURCE_TYPE_YOUTUBE_URL', label: 'YouTube URL' },
  { value: 'SOURCE_TYPE_ARTICLE_URL', label: 'Article URL' },
  { value: 'SOURCE_TYPE_RAW_TEXT',    label: 'Raw Text'    },
];

type JobStatus =
  | 'JOB_STATUS_QUEUED'
  | 'JOB_STATUS_FETCHING'
  | 'JOB_STATUS_PROCESSING'
  | 'JOB_STATUS_COMPLETE'
  | 'JOB_STATUS_FAILED'
  | '';

export default function SubmitPage() {
  const router = useRouter();
  const [source, setSource]         = useState('');
  const [sourceType, setSourceType] = useState('SOURCE_TYPE_YOUTUBE_URL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [jobId, setJobId]           = useState('');
  const [status, setStatus]         = useState<JobStatus>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/');
  }, []);

  useEffect(() => {
    if (!jobId) return;

    intervalRef.current = setInterval(async () => {
      try {
        const { data } = await jobs.getStatus(jobId);
        setStatus(data.status);

        if (data.status === 'JOB_STATUS_COMPLETE') {
          clearInterval(intervalRef.current!);

          // Wait briefly — storage write may still be in flight
          await new Promise(res => setTimeout(res, 1500));

          try {
            const { data: listData } = await results.list(1, 1);
            const newest = listData.results?.[0];
            if (newest) {
              router.push(`/results/${newest.result_id}`);
            } else {
              router.push('/dashboard');
            }
          } catch {
            router.push('/dashboard');
          }
        }

        if (data.status === 'JOB_STATUS_FAILED') {
          clearInterval(intervalRef.current!);
          setError(data.error_message || 'Job failed. Please try again.');
          setJobId('');
          setStatus('');
        }
      } catch {
        clearInterval(intervalRef.current!);
        setError('Lost connection while polling. Check your dashboard.');
      }
    }, 2000);

    return () => clearInterval(intervalRef.current!);
  }, [jobId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await jobs.submit(source.trim(), sourceType);
      setJobId(data.job_id);
      setStatus('JOB_STATUS_QUEUED');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const isPolling = !!jobId &&
    status !== 'JOB_STATUS_COMPLETE' &&
    status !== 'JOB_STATUS_FAILED';

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">New Distillation</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Type
            </label>
            <select
              value={sourceType}
              onChange={e => setSourceType(e.target.value)}
              disabled={isPolling}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {SOURCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {sourceType === 'SOURCE_TYPE_RAW_TEXT' ? 'Text Content' : 'URL'}
            </label>
            {sourceType === 'SOURCE_TYPE_RAW_TEXT' ? (
              <textarea
                required
                value={source}
                onChange={e => setSource(e.target.value)}
                rows={8}
                placeholder="Paste your text here (min 50 characters)…"
                disabled={isPolling}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            ) : (
              <input
                type="url"
                required
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder={
                  sourceType === 'SOURCE_TYPE_YOUTUBE_URL'
                    ? 'https://www.youtube.com/watch?v=...'
                    : 'https://example.com/article'
                }
                disabled={isPolling}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          {isPolling && (
            <div className="flex items-center gap-3 bg-indigo-50 rounded-lg px-4 py-3">
              <svg
                className="animate-spin h-4 w-4 text-indigo-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-indigo-700">Processing…</p>
                <StatusBadge status={status} />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || isPolling}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : isPolling ? 'Processing…' : 'Distill'}
          </button>
        </form>
      </main>
    </>
  );
}