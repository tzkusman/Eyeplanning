'use client';

import React, { useState, useMemo } from 'react';
import { Challan, StitchingStatus, UserProfile } from '@/types';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Tag,
  ArrowRight,
  Trash2,
  Edit3,
  AlertCircle,
  Activity,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { parseOrderDate } from '@/lib/storage';
import { exportChallansToExcel } from '@/lib/exportUtils';

interface DCHubProps {
  challans: Challan[];
  onSelectDC: (id: string) => void;
  onOpenNewDC: () => void;
  onEditDC: (challan: Challan) => void;
  onDeleteDC: (id: string) => void;
  onUpdateDCStatus?: (challan: Challan, newStatus: StitchingStatus) => void;
  currentUser: UserProfile | null;
}

export function DCHub({
  challans,
  onSelectDC,
  onOpenNewDC,
  onEditDC,
  onDeleteDC,
  onUpdateDCStatus,
  currentUser,
}: DCHubProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StitchingStatus>('ALL');
  const [dcToDelete, setDcToDelete] = useState<Challan | null>(null);

  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesDC = c.dcNo.toLowerCase().includes(query);
        const matchesParty = c.party.toLowerCase().includes(query);
        const matchesArticle = (c.article || '').toLowerCase().includes(query);
        if (!matchesDC && !matchesParty && !matchesArticle) return false;
      }
      return true;
    });
  }, [challans, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = challans.length;
    const processCount = challans.filter((c) => c.status === 'Process').length;
    const inlineCount = challans.filter((c) => c.status === 'Inline').length;
    const completeCount = challans.filter((c) => c.status === 'Complete').length;
    const totalQty = challans.reduce((sum, c) => sum + (c.openingQty || 0), 0);
    return { total, processCount, inlineCount, completeCount, totalQty };
  }, [challans]);

  const getStatusBadgeStyle = (status: StitchingStatus) => {
    switch (status) {
      case 'Process':
        return 'bg-sky-50 text-sky-700 border-sky-300 ring-sky-500/20';
      case 'Inline':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-indigo-500/20';
      case 'Complete':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-500/20';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-300 ring-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Challans</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tabular-nums text-slate-900">
            {stats.total}
          </p>
          <span className="text-[11px] text-slate-500">
            Total {stats.totalQty.toLocaleString()} pcs registered
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>In Process</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tabular-nums text-sky-700">
            {stats.processCount}
          </p>
          <span className="text-[11px] text-sky-600 font-medium">Active on sewing floor</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Inline QC</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tabular-nums text-indigo-700">
            {stats.inlineCount}
          </p>
          <span className="text-[11px] text-indigo-600 font-medium">Under quality audit</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Complete</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tabular-nums text-emerald-700">
            {stats.completeCount}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Production completed</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search DC #, Line, Assembly, Article..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-56 sm:w-72"
            />
          </div>

          {/* Stitching Status Filter Tabs */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({challans.length})
            </button>
            <button
              onClick={() => setStatusFilter('Process')}
              className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === 'Process'
                  ? 'bg-white text-sky-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Process ({stats.processCount})
            </button>
            <button
              onClick={() => setStatusFilter('Inline')}
              className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === 'Inline'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inline ({stats.inlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('Complete')}
              className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === 'Complete'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Complete ({stats.completeCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportChallansToExcel(filteredChallans)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
            title="Export Delivery Challans to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={onOpenNewDC}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Delivery Challan</span>
          </button>
        </div>
      </div>

      {/* Challans Table with Stitching Status Dropdown */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">DC Number</th>
                <th className="py-3 px-4">Line or Assembly</th>
                <th className="py-3 px-4">Article / Style</th>
                <th className="py-3 px-4 text-right">Opening Qty</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChallans.map((challan) => {
                const parsedDate = parseOrderDate(challan.orderDate);
                return (
                  <tr key={challan.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* DC # */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                      DC #{challan.dcNo}
                    </td>

                    {/* Party */}
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{challan.party}</span>
                      </div>
                    </td>

                    {/* Article */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {challan.article}
                    </td>

                    {/* Opening Qty */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {challan.openingQty.toLocaleString()} pcs
                    </td>

                    {/* Order Date */}
                    <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{parsedDate.display}</span>
                      </div>
                    </td>

                    {/* Status with Dropdown Menu */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center">
                        <select
                          value={challan.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as StitchingStatus;
                            onUpdateDCStatus?.(challan, newStatus);
                          }}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 ${getStatusBadgeStyle(
                            challan.status
                          )}`}
                          title="Click to change status in Supabase"
                        >
                          <option value="Process">⏳ Process</option>
                          <option value="Inline">⚡ Inline</option>
                          <option value="Complete">✅ Complete</option>
                        </select>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectDC(challan.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs shadow-xs"
                        >
                          <span>Open Planning</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onEditDC(challan)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit DC Specs"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDcToDelete(challan)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete DC"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredChallans.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No delivery challans match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete DC Dialog */}
      {dcToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-5 space-y-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Confirm DC Deletion</span>
            </div>
            <p className="text-slate-600">
              Are you sure you want to delete <strong>DC #{dcToDelete.dcNo}</strong> ({dcToDelete.party})?
              This will remove this lot from Supabase and local storage.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setDcToDelete(null)}
                className="px-3 py-1.5 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteDC(dcToDelete.id);
                  setDcToDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
