'use client';

import React, { useState } from 'react';
import {
  Database,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Terminal,
  ShieldCheck,
  FileCode,
  Download,
  Sparkles,
} from 'lucide-react';
import {
  SUPABASE_IN_DEPTH_SQL,
  STITCHING_STATUS_SQL,
  SUPABASE_URL,
  testSupabaseConnection,
} from '@/lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function SupabaseSetupModal({
  isOpen,
  onClose,
  onConnectionChange,
}: SupabaseSetupModalProps) {
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    hasTables: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCopyFullSQL = () => {
    navigator.clipboard.writeText(SUPABASE_IN_DEPTH_SQL);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2500);
  };

  const handleCopyStatusSQL = () => {
    navigator.clipboard.writeText(STITCHING_STATUS_SQL);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    const result = await testSupabaseConnection();
    setTestResult(result);
    onConnectionChange?.(result.hasTables);
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Supabase Production Database Management</h2>
              <p className="text-xs text-slate-400">
                PostgreSQL schema, Status constraints, and live table synchronization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Quick Status Migration Card */}
          <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-300 rounded-xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-950 font-bold">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>1-Click Status SQL Update for Supabase</span>
              </div>
              <button
                onClick={handleCopyStatusSQL}
                className="flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                {copiedStatus ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Quick SQL</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-sky-900 leading-relaxed">
              Run this 2-line SQL command in your Supabase SQL Editor to allow <strong>Process</strong>, <strong>Inline</strong>, and <strong>Complete</strong> values in your database:
            </p>
            <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-2.5 rounded-lg border border-slate-800 overflow-x-auto select-all">
              {STITCHING_STATUS_SQL}
            </pre>
          </div>

          {/* Connection status card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Target Supabase Project:</span>
                <code className="bg-slate-200/80 px-2 py-0.5 rounded font-mono text-[11px] text-slate-800 select-all">
                  {SUPABASE_URL}
                </code>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://supabase.com/dashboard/project/ekesyoziuhkgozcjqztj/sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 rounded font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>

                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded border text-xs font-medium flex items-center gap-2 ${
                  testResult.hasTables
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : testResult.connected
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {testResult.hasTables ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Complete SQL Code Block Preview with 1-Click Copy */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-950 text-slate-100">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>supabase_schema.sql (Complete Schema)</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/supabase_schema.sql"
                  download="supabase_schema.sql"
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs transition-all shadow-sm cursor-pointer border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Download .sql File</span>
                </a>
                <button
                  onClick={handleCopyFullSQL}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  {copiedFull ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Complete SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <pre className="p-4 text-[11px] font-mono text-emerald-300/90 max-h-56 overflow-y-auto leading-relaxed select-all">
              {SUPABASE_IN_DEPTH_SQL}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Server-Side API Route Bypasses RLS: Saves and synchronizes live directly to Supabase cloud.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
