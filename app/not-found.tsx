import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-md p-6 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-2">404 - Not Found</h2>
        <p className="text-xs text-slate-600 mb-4">
          The requested Delivery Challan or register ledger could not be found.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
