'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root Global Error caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50 text-slate-800 font-sans">
        <div className="max-w-md p-6 bg-white rounded-xl shadow-lg border border-slate-200">
          <h2 className="text-xl font-bold text-rose-600 mb-2">System Error</h2>
          <p className="text-xs text-slate-600 mb-4">
            An unexpected error occurred while running the planning software.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
