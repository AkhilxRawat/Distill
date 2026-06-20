'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { results } from '@/lib/api';
import Navbar from '@/components/Navbar';

interface QAPair {
  question: string;
  answer: string;
}

interface Result {
  result_id: string;
  job_id: string;
  source: string;
  source_type: string;
  summary: string;
  key_entities: string[];
  qa_pairs: QAPair[];
  topic_tags: string[];
  readability_score: number;
  tokens_used: number;
  created_at: number;
}

export default function ResultDetailPage() {
  const router   = useRouter();
  const { resultId } = useParams<{ resultId: string }>();
  const [result, setResult]   = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [openQA, setOpenQA]   = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/'); return; }
    fetchResult();
  }, [resultId]);

  async function fetchResult() {
    try {
      const { data } = await results.get(resultId);
      setResult(data);
    } catch (err: any) {
      if (err.response?.status === 404) setError('Result not found.');
      else if (err.response?.status === 401) router.push('/');
      else setError('Failed to load result.');
    } finally {
      setLoading(false);
    }
  }

  const sourceLabel: Record<string, string> = {
    SOURCE_TYPE_YOUTUBE_URL: 'YouTube',
    SOURCE_TYPE_ARTICLE_URL: 'Article',
    SOURCE_TYPE_RAW_TEXT:    'Raw Text',
  };

  if (loading) return (
    <>
      <Navbar />
      <p className="text-center text-gray-400 mt-16 text-sm">Loading…</p>
    </>
  );

  if (error) return (
    <>
      <Navbar />
      <p className="text-center text-red-500 mt-16 text-sm">{error}</p>
    </>
  );

  if (!result) return null;

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {sourceLabel[result.source_type] ?? result.source_type}
            </span>
            <p className="mt-1 text-xs text-gray-400 break-all">{result.source}</p>
          </div>
          <p className="text-xs text-gray-400 whitespace-nowrap">
            {new Date(result.created_at * 1000).toLocaleDateString()}
          </p>
        </div>

        {/* Summary */}
        <section className="bg-white rounded-2xl border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Summary
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">{result.summary}</p>
        </section>

        {/* Topic Tags */}
        {result.topic_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {result.topic_tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Key Entities */}
        {result.key_entities?.length > 0 && (
          <section className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Key Entities
            </h2>
            <div className="flex flex-wrap gap-2">
              {result.key_entities.map(e => (
                <span key={e} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                  {e}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Q&A Pairs — accordion */}
        {result.qa_pairs?.length > 0 && (
          <section className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Q &amp; A
            </h2>
            <div className="space-y-2">
              {result.qa_pairs.map((pair, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOpenQA(openQA === i ? null : i)}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 flex justify-between items-center hover:bg-gray-50"
                  >
                    {pair.question}
                    <span className="text-gray-400 ml-2">{openQA === i ? '▲' : '▼'}</span>
                  </button>
                  {openQA === i && (
                    <div className="px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t">
                      {pair.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="flex gap-4 text-center">
          <div className="flex-1 bg-white rounded-2xl border shadow-sm p-4">
            <p className="text-2xl font-bold text-indigo-600">{result.readability_score}</p>
            <p className="text-xs text-gray-500 mt-1">Readability Score</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl border shadow-sm p-4">
            <p className="text-2xl font-bold text-indigo-600">
              {result.tokens_used.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Tokens Used</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </main>
    </>
  );
}