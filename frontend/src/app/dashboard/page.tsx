'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { results } from '@/lib/api';
import Navbar from '@/components/Navbar';
import ResultCard from '@/components/ResultCard';

interface Result {
  result_id: string;
  source: string;
  source_type: string;
  summary: string;
  topic_tags: string[];
  created_at: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems]     = useState<Result[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/');
      return;
    }
    fetchResults();
  }, [page]);

  async function fetchResults() {
    setLoading(true);
    setError('');
    try {
      const { data } = await results.list(page, PAGE_SIZE);
      setItems(data.results || []);
      setTotal(data.total  || 0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/');
      } else {
        setError('Failed to load results.');
      }
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">
            Your Distillations
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({total} total)
              </span>
            )}
          </h1>
          <Link
            href="/submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            + New
          </Link>
        </div>

        {loading && (
          <p className="text-gray-400 text-sm">Loading…</p>
        )}

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">No distillations yet.</p>
            <Link href="/submit" className="text-indigo-600 hover:underline text-sm">
              Submit your first one →
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {items.map(item => (
            <ResultCard key={item.result_id} result={item} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </>
  );
}