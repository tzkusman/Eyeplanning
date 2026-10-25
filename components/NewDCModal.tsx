'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Challan, StitchingStatus } from '@/types';
import {
  parseOrderDate,
  getNextDateString,
  addDaysToDateString,
  calculateScheduleTimeline,
  ScheduleTimelineCalculation,
} from '@/lib/storage';
import {
  X,
  Plus,
  Save,
  AlertCircle,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface NewDCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDC: (challan: Challan) => void | Promise<void>;
  existingChallan?: Challan | null;
}

const COMMON_ITEMS = ['Skirt', 'Jacket', 'Jeans', 'Trousers', 'Shorts', 'Shirt', 'Hoodie'];

export function NewDCModal({
  isOpen,
  onClose,
  onSaveDC,
  existingChallan,
}: NewDCModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Form states with blank initial values (no dummy defaults)
  const [dcNo, setDcNo] = useState(() => existingChallan?.dcNo || '');
  const [party, setParty] = useState(() => existingChallan?.party || '');
  const [article, setArticle] = useState(() => existingChallan?.article || '');
  const [item, setItem] = useState(() => existingChallan?.item || '');
  const [openingQty, setOpeningQty] = useState(() =>
    existingChallan ? String(existingChallan.openingQty) : ''
  );

  const [orderDate, setOrderDate] = useState(() =>
    existingChallan?.orderDate
      ? parseOrderDate(existingChallan.orderDate).formatted
      : todayStr
  );

  // Automatic Expected Date: Defaults to Order Date + 4 days prep lead time
  const [firstExpectedDate, setFirstExpectedDate] = useState(() => {
    if (existingChallan?.firstExpectedDate) {
      return parseOrderDate(existingChallan.firstExpectedDate).formatted;
    }
    return addDaysToDateString(todayStr, 4);
  });

  const [dailyExpectedRate, setDailyExpectedRate] = useState(() =>
    existingChallan?.dailyExpectedRate
      ? String(existingChallan.dailyExpectedRate)
      : ''
  );

  const [status, setStatus] = useState<StitchingStatus>(() => existingChallan?.status || 'Process');
  const [notes, setNotes] = useState(() => existingChallan?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset or populate state whenever the modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevExistingId, setPrevExistingId] = useState(existingChallan?.id);

  if (isOpen !== prevIsOpen || existingChallan?.id !== prevExistingId) {
    setPrevIsOpen(isOpen);
    setPrevExistingId(existingChallan?.id);
    if (isOpen) {
      setDcNo(existingChallan?.dcNo || '');
      setParty(existingChallan?.party || '');
      setArticle(existingChallan?.article || '');
      setItem(existingChallan?.item || '');
      setOpeningQty(existingChallan ? String(existingChallan.openingQty) : '');

      const initialStart = existingChallan?.orderDate
        ? parseOrderDate(existingChallan.orderDate).formatted
        : todayStr;
      setOrderDate(initialStart);

      if (existingChallan?.firstExpectedDate) {
        setFirstExpectedDate(parseOrderDate(existingChallan.firstExpectedDate).formatted);
      } else {
        setFirstExpectedDate(addDaysToDateString(initialStart, 4));
      }

      setDailyExpectedRate(
        existingChallan?.dailyExpectedRate
          ? String(existingChallan.dailyExpectedRate)
          : ''
      );
      setStatus(existingChallan?.status || 'Process');
      setNotes(existingChallan?.notes || '');
      setError(null);
      setIsSubmitting(false);
    }
  }

  // Automatic date updater: when Order Date changes, automatically update First Expected Date (+4d prep by default)
  const handleOrderDateChange = (newOrderDate: string) => {
    setOrderDate(newOrderDate);
    if (newOrderDate) {
      setFirstExpectedDate(addDaysToDateString(newOrderDate, 4));
    }
  };

  // 1-Click: Match Start Date
  const handleSetSameAsStartDate = () => {
    if (orderDate) {
      setFirstExpectedDate(orderDate);
    }
  };

  // 1-Click: Reset to Today
  const handleSetToday = () => {
    setOrderDate(todayStr);
    setFirstExpectedDate(addDaysToDateString(todayStr, 4));
  };

  // Real-time automatic calculation engine (only computes when user supplies positive numbers)
  const calculation: ScheduleTimelineCalculation | null = useMemo(() => {
    const qty = Number(openingQty);
    const rate = Number(dailyExpectedRate);
    const start = firstExpectedDate || orderDate || todayStr;

    if (!qty || isNaN(qty) || qty <= 0 || !rate || isNaN(rate) || rate <= 0 || !start) {
      return null;
    }

    return calculateScheduleTimeline(qty, rate, start);
  }, [openingQty, dailyExpectedRate, firstExpectedDate, orderDate, todayStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dcNo.trim()) {
      setError('Please provide a DC Number (e.g. 3696 or 6789).');
      return;
    }
    if (!party.trim()) {
      setError('Please specify the Line or Assembly.');
      return;
    }
    const qty = Number(openingQty);
    if (isNaN(qty) || qty <= 0) {
      setError('Opening Quantity must be a valid positive number.');
      return;
    }
    if (!orderDate) {
      setError('Please select an Order Start Date.');
      return;
    }

    const rateVal = dailyExpectedRate.trim() ? Number(dailyExpectedRate) : 622;
    if (isNaN(rateVal) || rateVal <= 0) {
      setError('Daily Expected Output must be a valid positive number.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const challanToSave: Challan = {
      id: existingChallan
        ? existingChallan.id
        : `dc-${dcNo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || Date.now()}`,
      dcNo: dcNo.trim().toUpperCase(),
      party: party.trim(),
      article: article.trim() || 'Garment Batch',
      item: item.trim() || undefined,
      openingQty: qty,
      orderDate,
      firstExpectedDate: firstExpectedDate.trim() || orderDate,
      dailyExpectedRate: rateVal,
      notes: notes.trim(),
      status,
      createdBy: 'usr-admin-1',
      createdAt: existingChallan ? existingChallan.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSaveDC(challanToSave);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save: ${msg}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-sky-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded">
              {existingChallan ? 'UPDATE' : 'NEW DC'}
            </span>
            <h2 className="text-base font-bold">
              {existingChallan
                ? `Update Delivery Challan #${existingChallan.dcNo}`
                : 'Open New Delivery Challan (DC)'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: DC Number & Opening Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                DC NUMBER <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 3696 or 6789"
                value={dcNo}
                onChange={(e) => setDcNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-slate-900 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                OPENING QTY (PCS) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                placeholder="Enter opening quantity"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-slate-900 bg-white"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Initial lot quantity on order start date
              </span>
            </div>
          </div>

          {/* Row 2: Line or Assembly */}
          <div>
            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
              LINE OR ASSEMBLY <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Line 1 - Front & Back Assembly, Stitching Floor 2"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 font-medium bg-white"
              required
            />
          </div>

          {/* Row 3: Article / Style, Item & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                ARTICLE / STYLE
              </label>
              <input
                type="text"
                placeholder="e.g. dnm44 or Slim Fit"
                value={article}
                onChange={(e) => setArticle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold uppercase tracking-wide text-[10px]">
                  ITEM
                </label>
                <span className="text-[9.5px] text-slate-400">Garment Type</span>
              </div>
              <input
                type="text"
                placeholder="e.g. Skirt, Jacket, Jeans..."
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 font-medium bg-white"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {COMMON_ITEMS.slice(0, 5).map((quickItem) => (
                  <button
                    key={quickItem}
                    type="button"
                    onClick={() => setItem(quickItem)}
                    className={`px-1.5 py-0.5 text-[9.5px] rounded border transition-colors cursor-pointer ${
                      item.toLowerCase() === quickItem.toLowerCase()
                        ? 'bg-sky-100 text-sky-800 border-sky-300 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {quickItem}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                STATUS <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StitchingStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold text-slate-900 bg-white"
              >
                <option value="Process">⏳ Process</option>
                <option value="Inline">⚡ Inline</option>
                <option value="Complete">✅ Complete</option>
              </select>
              <span className="text-[9.5px] text-slate-500 mt-0.5 block">
                Floor production status
              </span>
            </div>
          </div>

          {/* Section: Production Dates & Auto Expected Output Quota (EXACT MATCH WITH LIVE CALCULATION) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Production Dates & Auto Expected Output Quota</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold">
                Automatic formula calculation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Order Start Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold uppercase tracking-wide text-[10px]">
                    ORDER START DATE <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSetToday}
                    className="text-[9.5px] text-sky-600 hover:text-sky-800 font-semibold underline cursor-pointer"
                  >
                    Today
                  </button>
                </div>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => handleOrderDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-slate-900 font-bold text-xs bg-white"
                  required
                />
                <span className="text-[9px] text-slate-500 mt-0.5 block">Ledger opens on this day</span>
              </div>

              {/* First Expected Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold uppercase tracking-wide text-[10px]">
                    FIRST EXPECTED DATE
                  </label>
                  {orderDate && (
                    <button
                      type="button"
                      onClick={handleSetSameAsStartDate}
                      className="text-[9.5px] text-sky-600 hover:text-sky-800 font-semibold underline cursor-pointer"
                    >
                      = Start Date
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={firstExpectedDate}
                  onChange={(e) => setFirstExpectedDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-sky-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-slate-900 font-bold text-xs bg-sky-50/40"
                />
                <span className="text-[9px] text-sky-700 font-medium mt-0.5 block">
                  Expected output starts from this date
                </span>
              </div>

              {/* Daily Expected Rate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold uppercase tracking-wide text-[10px]">
                    DAILY EXPECTED RATE
                  </label>
                  <span className="text-[9px] text-slate-400">pcs/day</span>
                </div>
                <input
                  type="number"
                  placeholder="e.g. 622"
                  value={dailyExpectedRate}
                  onChange={(e) => setDailyExpectedRate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-slate-900 font-bold text-xs bg-white"
                />
                <span className="text-[9px] text-slate-500 mt-0.5 block">Target output per day</span>
              </div>
            </div>

            {/* REAL-TIME AUTOMATIC FORMULA PREVIEW (AUTOMATIC WHEN INPUTS ARE PROVIDED) */}
            {calculation ? (
              <div className="bg-sky-50/90 border border-sky-200 rounded-lg p-2.5 flex items-start gap-2.5 text-sky-950 text-[10.5px]">
                <Calendar className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div>
                    <span className="font-bold text-sky-900">Formula Preview: </span>
                    <span>
                      Will auto-schedule <strong>{calculation.workingDaysNeeded} working days</strong> starting{' '}
                      <strong>{firstExpectedDate}</strong> (
                      {calculation.remainder > 0
                        ? `${calculation.fullDays} days × ${calculation.dailyRate.toLocaleString()} pcs + 1 final day × ${calculation.remainder.toLocaleString()} pcs`
                        : `${calculation.workingDaysNeeded} days × ${calculation.dailyRate.toLocaleString()} pcs`}
                      , Sundays skipped).
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[10px] text-sky-800 font-medium">
                    <span>
                      📅 <strong>Projected Finish:</strong> {calculation.projectedEndDisplay}
                    </span>
                    <span>
                      ⚡ <strong>Total Quota:</strong> {calculation.openingQty.toLocaleString()} pcs
                    </span>
                    {calculation.sundaysSkipped > 0 && (
                      <span className="text-slate-500">
                        ({calculation.sundaysSkipped} Sunday off-day skipped)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-2.5 flex items-center gap-2 text-slate-500 text-[10.5px]">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Enter Opening Quantity and Daily Target Rate above to automatically calculate working days, Sunday skips, and completion date.
                </span>
              </div>
            )}
          </div>

          {/* Row 5: Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
              PRODUCTION REMARKS / NOTES
            </label>
            <textarea
              rows={2}
              placeholder="Optional remarks or line assembly instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 text-xs bg-white"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>Saves directly to Supabase cloud</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Auto-Scheduling...</span>
                  </>
                ) : existingChallan ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Update Challan</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Open DC in Supabase</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
