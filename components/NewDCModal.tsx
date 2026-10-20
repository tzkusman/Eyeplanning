'use client';

import React, { useState, useEffect } from 'react';
import { Challan, StitchingStatus } from '@/types';
import { parseOrderDate } from '@/lib/storage';
import { X, Plus, Save, AlertCircle, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';

interface NewDCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDC: (challan: Challan) => void;
  existingChallan?: Challan | null;
}

export function NewDCModal({
  isOpen,
  onClose,
  onSaveDC,
  existingChallan,
}: NewDCModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [dcNo, setDcNo] = useState(() => existingChallan?.dcNo || '');
  const [party, setParty] = useState(() => existingChallan?.party || '');
  const [article, setArticle] = useState(() => existingChallan?.article || '');
  const [openingQty, setOpeningQty] = useState(() =>
    existingChallan ? String(existingChallan.openingQty) : ''
  );
  const [orderDate, setOrderDate] = useState(() =>
    existingChallan?.orderDate ? parseOrderDate(existingChallan.orderDate).formatted : ''
  );
  const [status, setStatus] = useState<StitchingStatus>(() => existingChallan?.status || 'Process');
  const [notes, setNotes] = useState(() => existingChallan?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevExistingId, setPrevExistingId] = useState(existingChallan?.id);

  if (isOpen !== prevIsOpen || existingChallan?.id !== prevExistingId) {
    setPrevIsOpen(isOpen);
    setPrevExistingId(existingChallan?.id);
    if (isOpen) {
      setDcNo(existingChallan?.dcNo || '');
      setParty(existingChallan?.party || '');
      setArticle(existingChallan?.article || '');
      setOpeningQty(existingChallan ? String(existingChallan.openingQty) : '');
      setOrderDate(
        existingChallan?.orderDate ? parseOrderDate(existingChallan.orderDate).formatted : ''
      );
      setStatus(existingChallan?.status || 'Process');
      setNotes(existingChallan?.notes || '');
      setError(null);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dcNo.trim()) {
      setError('Please provide a DC Number.');
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
      setError('Please select an Order Start Date (the date production begins).');
      return;
    }

    const challanToSave: Challan = {
      id: existingChallan
        ? existingChallan.id
        : `dc-${dcNo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || Date.now()}`,
      dcNo: dcNo.trim().toUpperCase(),
      party: party.trim(),
      article: article.trim() || 'Garment Batch',
      openingQty: qty,
      orderDate,
      notes: notes.trim(),
      status,
      createdBy: 'usr-admin-1',
      createdAt: existingChallan ? existingChallan.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveDC(challanToSave);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
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
            className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                DC Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 3696 or 6789"
                value={dcNo}
                onChange={(e) => setDcNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                Opening QTY (pcs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                placeholder="Enter opening quantity"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-slate-900"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Initial lot quantity on order start date
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
              Line or Assembly <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Line 1 - Front & Back Assembly, Stitching Floor 2"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                Article / Style
              </label>
              <input
                type="text"
                placeholder="e.g. Denim Stretch 12.5oz"
                value={article}
                onChange={(e) => setArticle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold uppercase tracking-wide text-[10px]">
                  Order Start Date <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setOrderDate(todayStr)}
                  className="text-[9.5px] text-sky-600 hover:text-sky-800 font-semibold underline cursor-pointer"
                >
                  Set to Today
                </button>
              </div>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-slate-900 font-bold"
                required
              />
              <span className="text-[9.5px] text-sky-600 font-medium mt-0.5 block">
                Production starts on this day
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StitchingStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold text-slate-900 bg-white"
              >
                <option value="Process">Process</option>
                <option value="Inline">Inline</option>
                <option value="Complete">Complete</option>
              </select>
              <span className="text-[9.5px] text-slate-500 mt-0.5 block">
                Floor production status
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wide text-[10px]">
              Production Remarks / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Optional remarks or line assembly instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>Saves directly to Supabase cloud</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-xs transition-all cursor-pointer"
              >
                {existingChallan ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{existingChallan ? 'Update Challan' : 'Open DC in Supabase'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
