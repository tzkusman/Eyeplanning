'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50 text-slate-800">
      <h2 className="text-2xl font-bold text-rose-600">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-600 max-w-md">
        An unexpected error occurred while loading the planning system.
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}
