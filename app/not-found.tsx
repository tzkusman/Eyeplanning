import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-900">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-slate-600 mb-4 text-sm">Could not find requested resource.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-500 transition-colors"
      >
        Return to Planning Register
      </Link>
    </div>
  );
}
