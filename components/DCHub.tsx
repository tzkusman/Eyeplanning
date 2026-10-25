'use client';

import React, { useState, useMemo } from 'react';
import { Challan, StitchingStatus, UserProfile } from '@/types';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  ArrowRight,
  Trash2,
  Edit3,
  AlertCircle,
  Activity,
  Calendar,
  FileSpreadsheet,
  Shirt,
  X,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { parseOrderDate, getLocalChallanBalance } from '@/lib/storage';
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
  const [visibleCount, setVisibleCount] = useState(10);

  // 1. Filter challans using smart multi-format search (supports 'd', 'dc', '#', 'dc 7596', '#7596', or digits)
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchTerm.trim() !== '') {
        const rawQuery = searchTerm.trim().toLowerCase();
        
        // Strip common prefixes like 'delivery challan', 'challan', 'dc number', 'dc no', 'dc', '#', etc.
        const queryWithoutDC = rawQuery
          .replace(/^(delivery\s*challan|delivery|challan|dc\s*number|dc\s*no\.?|dc\s*#?|#)\s*/i, '')
          .trim();
        const queryDigits = rawQuery.replace(/\D/g, '');

        const rawDcNo = String(c.dcNo || '').trim();
        const dcNo = rawDcNo.toLowerCase();
        const dcNoDigits = dcNo.replace(/\D/g, '');

        // If query is just 'd', 'dc', 'dc#', 'dc no', 'challan', etc., match all Delivery Challans
        const isGenericDCPrefix =
          rawQuery === 'd' ||
          rawQuery === 'dc' ||
          rawQuery === 'dc.' ||
          rawQuery === 'dc:' ||
          rawQuery === 'dc#' ||
          rawQuery === 'dc #' ||
          rawQuery === '#' ||
          rawQuery === 'dc-' ||
          rawQuery === 'dc no' ||
          rawQuery === 'dc no.' ||
          rawQuery === 'dc number' ||
          rawQuery === 'challan' ||
          rawQuery === 'delivery' ||
          rawQuery === 'delivery challan';

        const matchesDC =
          isGenericDCPrefix ||
          dcNo.includes(rawQuery) ||
          `dc #${dcNo}`.includes(rawQuery) ||
          `dc ${dcNo}`.includes(rawQuery) ||
          `dc#${dcNo}`.includes(rawQuery) ||
          `#${dcNo}`.includes(rawQuery) ||
          (queryWithoutDC.length > 0 && dcNo.includes(queryWithoutDC)) ||
          (queryDigits.length > 0 && dcNoDigits.length > 0 && dcNoDigits.includes(queryDigits));

        const matchesParty =
          (c.party || '').toLowerCase().includes(rawQuery) ||
          (queryWithoutDC.length > 0 && (c.party || '').toLowerCase().includes(queryWithoutDC));
        const matchesArticle =
          (c.article || '').toLowerCase().includes(rawQuery) ||
          (queryWithoutDC.length > 0 && (c.article || '').toLowerCase().includes(queryWithoutDC));
        const matchesItem =
          (c.item || '').toLowerCase().includes(rawQuery) ||
          (queryWithoutDC.length > 0 && (c.item || '').toLowerCase().includes(queryWithoutDC));
        const matchesNotes = (c.notes || '').toLowerCase().includes(rawQuery);

        if (!matchesDC && !matchesParty && !matchesArticle && !matchesItem && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [challans, searchTerm, statusFilter]);

  // 2. Sort chronologically descending (latest orders and latest created at the top)
  const sortedFilteredChallans = useMemo(() => {
    return [...filteredChallans].sort((a, b) => {
      const dateA = parseOrderDate(a.orderDate).formatted;
      const dateB = parseOrderDate(b.orderDate).formatted;
      if (dateB !== dateA) return dateB.localeCompare(dateA);

      if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }

      const numA = parseInt(String(a.dcNo).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.dcNo).replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
  }, [filteredChallans]);

  // 3. Batch display: If actively searching or filtering, show all matching results immediately;
  // otherwise, default to top 10 latest with "Load 10 More"
  const isFilteringOrSearching = searchTerm.trim() !== '' || statusFilter !== 'ALL';
  const displayedChallans = useMemo(() => {
    if (isFilteringOrSearching) {
      return sortedFilteredChallans;
    }
    return sortedFilteredChallans.slice(0, visibleCount);
  }, [sortedFilteredChallans, isFilteringOrSearching, visibleCount]);

  const hasMore = sortedFilteredChallans.length > visibleCount;
  const remainingCount = Math.max(0, sortedFilteredChallans.length - visibleCount);

  const stats = useMemo(() => {
    const total = challans.length;
    const processCount = challans.filter((c) => c.status === 'Process').length;
    const inlineCount = challans.filter((c) => c.status === 'Inline').length;
    const completeCount = challans.filter((c) => c.status === 'Complete').length;
    const totalQty = challans.reduce((sum, c) => sum + (c.openingQty || 0), 0);
    const totalRemaining = challans.reduce((sum, c) => {
      const bal = getLocalChallanBalance(c);
      return sum + bal.remainingBalance;
    }, 0);
    return { total, processCount, inlineCount, completeCount, totalQty, totalRemaining };
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
    <div className="space-y-6 w-full">
      {/* Overview Stat Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Challans</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-black font-mono tabular-nums text-slate-900">
            {stats.total}
          </p>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            Total {stats.totalQty.toLocaleString()} pcs registered
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>In Process</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <p className="mt-2 text-3xl font-black font-mono tabular-nums text-sky-700">
            {stats.processCount}
          </p>
          <span className="text-xs text-sky-600 font-semibold mt-1 block">Active on sewing floor</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Inline QC</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-black font-mono tabular-nums text-indigo-700">
            {stats.inlineCount}
          </p>
          <span className="text-xs text-indigo-600 font-semibold mt-1 block">Under quality audit</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Remaining Balance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-black font-mono tabular-nums text-slate-900">
            {stats.totalRemaining.toLocaleString()}{' '}
            <span className="text-sm font-sans text-slate-500 font-bold">pcs</span>
          </p>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">
            {stats.completeCount} lots fully completed
          </span>
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
              placeholder="Search DC #, Line, Assembly, Article, Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-56 sm:w-80"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
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

      {/* Challans Table with Dedicated Item & Remaining Balance Columns */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-xs tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-5 w-[11%]">DC Number</th>
                <th className="py-3.5 px-4 sm:px-5 w-[16%]">Line or Assembly</th>
                <th className="py-3.5 px-4 sm:px-5 w-[13%]">Article / Style</th>
                <th className="py-3.5 px-4 w-[10%]">Item</th>
                <th className="py-3.5 px-4 sm:px-5 text-right w-[11%]">Opening Qty</th>
                <th className="py-3.5 px-4 sm:px-5 text-right w-[16%]">Remaining Balance</th>
                <th className="py-3.5 px-4 sm:px-5 w-[10%]">Order Date</th>
                <th className="py-3.5 px-4 sm:px-5 w-[8%]">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-right w-[5%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedChallans.map((challan) => {
                const parsedDate = parseOrderDate(challan.orderDate);
                const balInfo = getLocalChallanBalance(challan);
                const isFinished = balInfo.remainingBalance === 0 || challan.status === 'Complete';

                return (
                  <tr key={challan.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* DC # */}
                    <td className="py-4 px-4 sm:px-5 font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                      DC #{challan.dcNo}
                    </td>

                    {/* Line or Assembly */}
                    <td className="py-4 px-4 sm:px-5 font-semibold text-slate-800 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{challan.party}</span>
                      </div>
                    </td>

                    {/* Article / Style */}
                    <td className="py-4 px-4 sm:px-5 text-slate-700 text-sm font-medium">
                      {challan.article}
                    </td>

                    {/* Dedicated Item Column */}
                    <td className="py-4 px-4">
                      {challan.item ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-bold border border-slate-200 text-xs whitespace-nowrap">
                          <Shirt className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{challan.item}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">—</span>
                      )}
                    </td>

                    {/* Opening Qty */}
                    <td className="py-4 px-4 sm:px-5 text-right font-mono font-bold text-slate-900 text-sm tabular-nums whitespace-nowrap">
                      {challan.openingQty.toLocaleString()} pcs
                    </td>

                    {/* Dedicated Remaining Balance Column with Completion Progress */}
                    <td className="py-4 px-4 sm:px-5 text-right whitespace-nowrap">
                      {isFinished ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Complete (0 left)</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">100% finished</span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-end">
                          <div className="flex items-center gap-1 font-mono font-bold text-slate-900 tabular-nums text-sm">
                            <span>{balInfo.remainingBalance.toLocaleString()} pcs</span>
                            <span className="text-[11px] text-amber-600 font-sans font-bold">left</span>
                          </div>
                          {/* Micro Progress Bar */}
                          <div className="w-32 bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden border border-slate-200 flex">
                            <div
                              className="bg-sky-500 h-full rounded-full transition-all"
                              style={{ width: `${balInfo.completionRate}%` }}
                            />
                          </div>
                          <span className="text-[10.5px] text-slate-600 font-mono mt-0.5">
                            {balInfo.totalActual.toLocaleString()} / {balInfo.totalInput.toLocaleString()} pcs ({balInfo.completionRate}%)
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Order Date */}
                    <td className="py-4 px-4 sm:px-5 font-mono text-slate-800 tabular-nums font-semibold text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{parsedDate.display}</span>
                      </div>
                    </td>

                    {/* Status with Dropdown Menu */}
                    <td className="py-4 px-4 sm:px-5 whitespace-nowrap">
                      <div className="inline-flex items-center">
                        <select
                          value={challan.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as StitchingStatus;
                            onUpdateDCStatus?.(challan, newStatus);
                          }}
                          className={`text-xs font-bold rounded-lg px-3 py-1.5 border transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 ${getStatusBadgeStyle(
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
                    <td className="py-4 px-4 sm:px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectDC(challan.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs shadow-xs"
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

              {displayedChallans.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="font-semibold text-slate-700">No delivery challans match your search or filter</span>
                      <span className="text-[11px] text-slate-400">
                        Try searching by DC number (e.g. 7596, #7596), Line, Article, or Item (e.g. Jacket, Skirt)
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination & Batch Loading Controls */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Summary Counter */}
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            {isFilteringOrSearching ? (
              <span>
                Found <strong className="text-slate-900 font-bold">{sortedFilteredChallans.length}</strong> matching Delivery Challan{sortedFilteredChallans.length === 1 ? '' : 's'} across entire archive
              </span>
            ) : (
              <span>
                Showing <strong className="text-slate-900 font-bold">{displayedChallans.length}</strong> of{' '}
                <strong className="text-slate-900 font-bold">{sortedFilteredChallans.length}</strong> latest Delivery Challans
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* If searching or filtering, show Clear Search / Filter button */}
            {isFilteringOrSearching && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setVisibleCount(10);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer shadow-2xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Search</span>
              </button>
            )}

            {/* If not searching and has more records to show */}
            {!isFilteringOrSearching && hasMore && (
              <>
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer shadow-xs transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>Load 10 More</span>
                  <span className="bg-sky-700 text-sky-100 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {remainingCount} remaining
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibleCount(sortedFilteredChallans.length)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer shadow-2xs transition-colors"
                >
                  View All ({sortedFilteredChallans.length})
                </button>
              </>
            )}

            {/* Option to collapse back to top 10 if user expanded it */}
            {!isFilteringOrSearching && visibleCount > 10 && sortedFilteredChallans.length > 10 && (
              <button
                type="button"
                onClick={() => setVisibleCount(10)}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
              >
                Show Top 10 Only
              </button>
            )}
          </div>
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
