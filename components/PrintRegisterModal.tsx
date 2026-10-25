'use client';

import React, { useState, useMemo } from 'react';
import { Challan, PlanningRow, PlanningTotals, UserProfile } from '@/types';
import { FULL_MONTH_NAMES, getCalendarDayInfo } from '@/lib/storage';
import { exportRegisterToExcel, exportRegisterToCSV } from '@/lib/exportUtils';
import {
  Printer,
  FileSpreadsheet,
  FileText,
  X,
  Check,
  Calendar,
  Building2,
  Tag,
  Hash,
  ShieldCheck,
  Loader2,
  Sparkles,
  Layers,
} from 'lucide-react';

interface PrintRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan;
  rows: PlanningRow[];
  totals: PlanningTotals;
  month: number;
  year: number;
  currentUser: UserProfile | null;
}

export function PrintRegisterModal({
  isOpen,
  onClose,
  challan,
  rows,
  totals,
  month,
  year,
  currentUser,
}: PrintRegisterModalProps) {
  const [scope, setScope] = useState<'current_month' | 'all_dates'>('all_dates');
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeKPIs, setIncludeKPIs] = useState(true);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const monthName = FULL_MONTH_NAMES[month - 1];

  // Filter rows based on selected scope
  const targetRows = useMemo(() => {
    if (scope === 'current_month') {
      return rows.filter((r) => r.year === year && r.month === month);
    }
    return [...rows].sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());
  }, [rows, scope, month, year]);

  if (!isOpen) return null;

  const handlePrint = () => {
    // Add print class to document.body so only the printable sheet is rendered
    document.body.classList.add('printing-sheet-active');

    // Trigger browser print dialog (printer OR 'Save as PDF')
    window.print();

    // Clean up class after dialog closes
    const cleanUp = () => {
      document.body.classList.remove('printing-sheet-active');
      window.removeEventListener('afterprint', cleanUp);
    };
    window.addEventListener('afterprint', cleanUp);
    setTimeout(cleanUp, 1500);
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportRegisterToExcel({
        challan,
        rows: targetRows,
        totals,
        monthName,
        year,
        scope,
        userName: currentUser?.fullName || 'Production Supervisor',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = () => {
    exportRegisterToCSV({
      challan,
      rows: targetRows,
      totals,
      monthName,
      year,
      scope,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 border border-sky-400/30 text-sky-400 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Print & Export Production Register</h3>
                <span className="text-xs font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2.5 py-0.5 rounded-full">
                  DC #{challan.dcNo}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Official Production & Stitching Report for{' '}
                <strong className="text-white">{challan.party}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Scope Selector */}
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
              Report Scope:
            </span>
            <div className="inline-flex bg-slate-200/80 rounded-lg p-0.5 border border-slate-300/80 shadow-2xs">
              <button
                onClick={() => setScope('all_dates')}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                  scope === 'all_dates'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Dates ({rows.length} Days)
              </button>
              <button
                onClick={() => setScope('current_month')}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                  scope === 'current_month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {monthName} {year} Only
              </button>
            </div>
          </div>

          {/* Options Toggles */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeKPIs}
                onChange={(e) => setIncludeKPIs(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span>Executive KPI Cards</span>
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span>Authorization Signatures</span>
            </label>
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-800 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Download executive styled Excel spreadsheet with formulas and column widths"
            >
              {isExportingExcel ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>Formatting Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                  <span>Export Excel (.xlsx)</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Download plain CSV"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Print directly or save as PDF"
            >
              <Printer className="w-4 h-4 text-sky-100" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>

        {/* Live Printable Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100">
          <div
            id="printable-register-sheet"
            className="bg-white p-7 sm:p-9 rounded-xl shadow-md border border-slate-300 max-w-4xl mx-auto print:max-w-none print:p-0 print:border-none print:shadow-none"
          >
            {/* Report Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                      DENIM CRAFTS APPAREL
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Manufacturing Division
                    </span>
                  </div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    PRODUCTION &amp; STITCHING REGISTER
                  </h1>
                  <p className="text-xs font-semibold text-slate-600">
                    Official Date-Wise Assembly Ledger &amp; Quota Variance Sheet
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-sky-400 font-mono font-black text-base rounded shadow-xs">
                    DC #{challan.dcNo}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Lot Tracking Ref: {challan.id.substring(0, 8)}
                  </p>
                </div>
              </div>

              {/* Master Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs">
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Line / Assembly:
                  </span>
                  <span className="font-bold text-slate-900 text-xs">{challan.party}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Article / Style:
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {challan.article || 'Standard'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Opening Lot Qty:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {challan.openingQty.toLocaleString()} Pcs
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Stitching Status:
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border mt-0.5 ${
                      challan.status === 'Complete'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : challan.status === 'Inline'
                        ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {challan.status}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Order Start Date:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {challan.orderDate}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Report Scope:
                  </span>
                  <span className="font-semibold text-slate-900 text-xs">
                    {scope === 'all_dates' ? 'Full Order Register' : `${monthName} ${year}`}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Report Date:
                  </span>
                  <span className="font-mono text-slate-700 text-xs">
                    {new Date().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Authorized By:
                  </span>
                  <span className="font-medium text-slate-800 text-xs truncate block">
                    {currentUser?.fullName || 'Production Supervisor'}
                  </span>
                </div>
              </div>
            </div>

            {/* Optional KPI Summary Cards */}
            {includeKPIs && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4 print:mb-3 text-center">
                <div className="p-2.5 bg-slate-50 border border-slate-300 rounded print:rounded-none">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">
                    Target Input
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900">
                    {totals.targetInput.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded print:rounded-none">
                  <span className="text-[9px] font-bold text-indigo-700 uppercase block tracking-wider">
                    Expected Quota
                  </span>
                  <span className="font-mono font-black text-sm text-indigo-900">
                    {totals.totalExpectedOutput.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded print:rounded-none">
                  <span className="text-[9px] font-bold text-emerald-700 uppercase block tracking-wider">
                    Actual Output
                  </span>
                  <span className="font-mono font-black text-sm text-emerald-900">
                    {totals.totalActualOutput.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded print:rounded-none">
                  <span className="text-[9px] font-bold text-sky-800 uppercase block tracking-wider">
                    Net Variance
                  </span>
                  <span
                    className={`font-mono font-black text-sm ${
                      totals.netDifference >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {totals.netDifference > 0
                      ? `+${totals.netDifference.toLocaleString()}`
                      : totals.netDifference.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded print:rounded-none">
                  <span className="text-[9px] font-bold text-amber-800 uppercase block tracking-wider">
                    Closing Balance
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900">
                    {totals.currentBalance.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded print:rounded-none">
                  <span className="text-[9px] font-bold text-purple-700 uppercase block tracking-wider">
                    Completion
                  </span>
                  <span className="font-mono font-black text-sm text-purple-900">
                    {totals.completionRate}%
                  </span>
                </div>
              </div>
            )}

            {/* The Print Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider divide-x divide-slate-700 border-b-2 border-slate-900">
                    <th className="py-2.5 px-2 text-center border border-slate-700 w-20">Date</th>
                    <th className="py-2.5 px-2 text-center border border-slate-700 w-12">Day</th>
                    <th className="py-2.5 px-2 text-center border border-slate-700 w-16">DC #</th>
                    <th className="py-2.5 px-2 text-right border border-slate-700 w-20">Initial</th>
                    <th className="py-2.5 px-2 text-right border border-slate-700 w-20">Input</th>
                    <th className="py-2.5 px-2 text-center border border-slate-700 w-12">Gap</th>
                    <th className="py-2.5 px-2 text-right border border-slate-700 w-28">Expected Output</th>
                    <th className="py-2.5 px-2 text-right border border-slate-700 w-28">Actual Output</th>
                    <th className="py-2.5 px-2 text-right border border-slate-700 w-28 bg-slate-800 text-sky-300">
                      Diff (Act - Exp)
                    </th>
                    <th className="py-2.5 px-2 text-right border border-slate-700 w-24 bg-slate-800 text-white">
                      Balance
                    </th>
                    <th className="py-2.5 px-2 text-center border border-slate-700 w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {targetRows.map((row, index) => {
                    const isFirstRow = index === 0;
                    const dayInfo = getCalendarDayInfo(row.dateStr);
                    const dayOfWeek = dayInfo.dayOfWeek;
                    const isSunday = dayInfo.isSunday;

                    const hasActual =
                      row.actualOutput !== null &&
                      row.actualOutput !== undefined &&
                      row.actualOutput !== 0;
                    const hasExpected =
                      row.expectedOutput !== null &&
                      row.expectedOutput !== undefined &&
                      row.expectedOutput !== 0;
                    const dailyDiff = (row.actualOutput || 0) - (row.expectedOutput || 0);

                    // Month boundary indicator
                    const prevRow = index > 0 ? targetRows[index - 1] : null;
                    const isNewMonth =
                      prevRow && (prevRow.month !== row.month || prevRow.year !== row.year);

                    const isZebra = index % 2 === 1;

                    return (
                      <React.Fragment key={row.id}>
                        {isNewMonth && (
                          <tr className="bg-sky-100 font-bold border-y-2 border-sky-400 print-avoid-break">
                            <td
                              colSpan={11}
                              className="py-1 px-3 text-sky-950 font-bold text-[11px]"
                            >
                              Continued into {FULL_MONTH_NAMES[row.month - 1]} {row.year} — Carried
                              Balance: {prevRow.balance.toLocaleString()} pcs
                            </td>
                          </tr>
                        )}
                        <tr
                          className={`divide-x divide-slate-300 border-b border-slate-300 print-avoid-break ${
                            row.isZeroBalance
                              ? 'bg-rose-50/70 font-semibold'
                              : isSunday
                              ? 'bg-rose-50/40'
                              : isZebra
                              ? 'bg-slate-50/60'
                              : 'bg-white'
                          }`}
                        >
                          <td className="py-1.5 px-2 text-center font-mono font-bold border border-slate-300 text-slate-900">
                            {row.dayLabel || row.dateStr}
                          </td>
                          <td
                            className={`py-1.5 px-2 text-center border border-slate-300 ${
                              isSunday ? 'text-rose-600 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {dayOfWeek}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700 border border-slate-300">
                            {isFirstRow ? challan.dcNo : ''}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-700 border border-slate-300">
                            {isFirstRow ? challan.openingQty.toLocaleString() : ''}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-sky-900 border border-slate-300">
                            {row.inputQty !== null && row.inputQty !== undefined && row.inputQty > 0
                              ? Number(row.inputQty).toLocaleString()
                              : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-slate-500 border border-slate-300">
                            {row.daysGap && row.daysGap > 0 ? `${row.daysGap}d` : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-indigo-900 font-bold border border-slate-300">
                            {row.expectedOutput !== null &&
                            row.expectedOutput !== undefined &&
                            row.expectedOutput > 0
                              ? Number(row.expectedOutput).toLocaleString()
                              : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-emerald-900 font-bold border border-slate-300">
                            {row.actualOutput !== null &&
                            row.actualOutput !== undefined &&
                            row.actualOutput > 0
                              ? Number(row.actualOutput).toLocaleString()
                              : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold border border-slate-300 bg-sky-50/50">
                            {hasActual || hasExpected ? (
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  dailyDiff > 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : dailyDiff < 0
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'text-slate-600'
                                }`}
                              >
                                {dailyDiff > 0 ? `+${dailyDiff}` : dailyDiff}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold tabular-nums border border-slate-300 bg-slate-100/50 text-slate-900">
                            {Number(row.balance || 0).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-center border border-slate-300">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.status === 'Complete'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : row.status === 'Inline'
                                  ? 'bg-indigo-100 text-indigo-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {row.status || 'Process'}
                            </span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 font-black text-white border-t-2 border-slate-900 divide-x divide-slate-700 print-avoid-break">
                    <td colSpan={3} className="py-2 px-2 text-center uppercase tracking-wider text-sky-400">
                      TOTALS &amp; BALANCES
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-300">
                      {challan.openingQty.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-sky-300">
                      {totals.targetInput.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500">—</td>
                    <td className="py-2 px-2 text-right font-mono text-indigo-300">
                      {totals.totalExpectedOutput.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-300">
                      {totals.totalActualOutput.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-sky-300">
                      {totals.netDifference > 0
                        ? `+${totals.netDifference.toLocaleString()}`
                        : totals.netDifference.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-sm text-white">
                      {totals.currentBalance.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-slate-300">{challan.status}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Optional Signatures Section */}
            {includeSignatures && (
              <div className="mt-8 pt-5 border-t-2 border-slate-300 grid grid-cols-4 gap-4 text-center print-avoid-break">
                <div className="space-y-4">
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 uppercase">Prepared By</p>
                    <p className="text-[9px] text-slate-500">Data Operator</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 uppercase">
                      Line Supervisor
                    </p>
                    <p className="text-[9px] text-slate-500">{challan.party}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 uppercase">QA Inspector</p>
                    <p className="text-[9px] text-slate-500">Quality Assurance</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 uppercase">
                      Production Manager
                    </p>
                    <p className="text-[9px] text-slate-500">Authorized Approval</p>
                  </div>
                </div>
              </div>
            )}

            {/* Print Footer Notice */}
            <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-mono">
              <span>
                Generated from Apparel Production Control System • DC #{challan.dcNo} ({challan.party})
              </span>
              <span>
                Printed {new Date().toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Tip: In the print dialog, select <strong>&quot;Save as PDF&quot;</strong> to export an official PDF document, or choose your local office printer.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
