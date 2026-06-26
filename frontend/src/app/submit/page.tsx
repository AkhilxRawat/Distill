'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jobs } from '@/lib/api';
import Navbar from '@/components/Navbar';
import StatusBar from '@/components/StatusBar';
import { useJobStatus } from '@/lib/ws';

const SOURCE_TYPES = [
  { value: 'SOURCE_TYPE_YOUTUBE_URL', label: 'YouTube URL' },
  { value: 'SOURCE_TYPE_ARTICLE_URL', label: 'Article URL' },
  { value: 'SOURCE_TYPE_RAW_TEXT',    label: 'Raw Text'    },
];

export default function SubmitPage() {
  const router = useRouter();
  const [source, setSource]         = useState('');
  const [sourceType, setSourceType] = useState('SOURCE_TYPE_YOUTUBE_URL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Hook handles connection, subscription, and state updates
  const { status, chunks, resultId } = useJobStatus(activeJobId);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/');
  }, [router]);

  // Handle successful completion and redirect to results
  useEffect(() => {
    if (resultId) {
      router.push(`/results/${resultId}`);
    }
  }, [resultId, router]);

  // Handle failure case
  useEffect(() => {
    if (status === 'JOB_STATUS_FAILED') {
      setError('Job failed. Please check your content/url and try again.');
      setActiveJobId(null);
    }
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await jobs.submit(source.trim(), sourceType);
      setActiveJobId(data.job_id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Submission failed.');
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  }

  const isPolling = !!activeJobId &&
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
            <StatusBar status={status} chunks={chunks} />
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