'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();
  const userId = typeof window !== 'undefined'
    ? localStorage.getItem('user_id') : '';

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    router.push('/');
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-indigo-600 text-lg">
          Distill
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/submit" className="text-sm text-gray-600 hover:text-indigo-600">
            New
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-indigo-600">
            Dashboard
          </Link>
          {userId && (
            <span className="text-xs text-gray-400 border rounded-full px-2 py-0.5">
              {userId}
            </span>
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-500 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}