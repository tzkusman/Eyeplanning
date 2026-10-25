'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Challan, PlanningRow, PlanningTotals, StitchingStatus, UserProfile } from '@/types';
import {
  MONTH_NAMES,
  FULL_MONTH_NAMES,
  parseOrderDate,
  addNextDayToRows,
  extendRowsThroughDate,
  getNextDateString,
  formatDayLabel,
  resetChallanPlanningEntries,
  generateAutoScheduledRows,
  getCalendarDayInfo,
  fillDateGapsInRows,
} from '@/lib/storage';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  CalendarPlus,
  CalendarRange,
  ArrowRightCircle,
  X,
  Sparkles,
  Pencil,
  Save,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  FileText,
  Download,
  Shirt,
  RotateCcw,
} from 'lucide-react';
import { PrintRegisterModal } from './PrintRegisterModal';
import { exportRegisterToExcel, exportRegisterToCSV } from '@/lib/exportUtils';

interface DateRegisterLedgerProps {
  challan: Challan;
  initialRows: PlanningRow[];
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  currentUser: UserProfile | null;
  onOpenNewDC: () => void;
  onEditDC?: () => void;
  onUpdateCurrentDC: (challan: Challan) => void;
  onDeleteCurrentDC: (challanId: string) => void;
  onSaveRowsToServer: (rows: PlanningRow[]) => Promise<{ success: boolean; count?: number; timestamp?: string } | void>;
  isLiveConnected?: boolean;
  lastLiveSyncTime?: string | null;
  onManualSync?: () => Promise<void>;
}

export function DateRegisterLedger({
  challan,
  initialRows,
  year,
  month,
  onYearChange,
  onMonthChange,
  currentUser,
  onOpenNewDC,
  onEditDC,
  onUpdateCurrentDC,
  onDeleteCurrentDC,
  onSaveRowsToServer,
  isLiveConnected = true,
  lastLiveSyncTime,
  onManualSync,
}: DateRegisterLedgerProps) {
  const [rows, setRows] = useState<PlanningRow[]>(initialRows);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isContinueModalOpen, setIsContinueModalOpen] = useState(false);
  const [customContinueDate, setCustomContinueDate] = useState<string>('');
  const [isEditingOrderDate, setIsEditingOrderDate] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isAutoScheduleModalOpen, setIsAutoScheduleModalOpen] = useState(false);
  const [modalTargetRate, setModalTargetRate] = useState<number>(800);
  const [autoScheduleNotification, setAutoScheduleNotification] = useState<{
    days: number;
    rate: number;
    remainder: number;
    endDateLabel: string;
    startRowId: string;
    previousExpectedRows: { id: string; val: number | null }[];
  } | null>(null);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rowsRef = useRef<PlanningRow[]>(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Real-time synchronization: Keep rows synchronized with live updates from Supabase
  const [prevInitialRows, setPrevInitialRows] = useState(initialRows);
  if (initialRows !== prevInitialRows) {
    setPrevInitialRows(initialRows);
    const isInputActive = typeof document !== 'undefined' && document.activeElement?.tagName === 'INPUT';
    if (!hasUnsavedChanges && !isInputActive) {
      setRows(initialRows);
    }
  }

  const parsedOrderDate = useMemo(() => {
    return parseOrderDate(challan.orderDate);
  }, [challan.orderDate]);

  const [prevFormattedDate, setPrevFormattedDate] = useState(parsedOrderDate.formatted);
  const [editDateVal, setEditDateVal] = useState(parsedOrderDate.formatted);

  if (parsedOrderDate.formatted !== prevFormattedDate) {
    setPrevFormattedDate(parsedOrderDate.formatted);
    setEditDateVal(parsedOrderDate.formatted);
  }

  // Explicit Save to Supabase function
  const saveCompletePlanToSupabase = useCallback(async (rowsToSave?: PlanningRow[]) => {
    const targetRows = rowsToSave || rowsRef.current;
    if (!targetRows || targetRows.length === 0) return true;

    setIsSaving(true);
    setSaveStatus('Saving plan entries...');

    try {
      await onSaveRowsToServer(targetRows);
      setIsSaving(false);
      setHasUnsavedChanges(false);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(nowStr);
      setSaveStatus(`All changes saved at ${nowStr}`);
      setTimeout(() => setSaveStatus(null), 3500);
      return true;
    } catch (err) {
      console.error('Save error:', err);
      setIsSaving(false);
      setSaveStatus('Error saving changes (cached locally)');
      setTimeout(() => setSaveStatus(null), 4000);
      return false;
    }
  }, [onSaveRowsToServer]);

  // Global keyboard shortcut: Ctrl+S or Cmd+S saves directly to Supabase
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCompletePlanToSupabase();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCompletePlanToSupabase]);

  const handleSaveOrderDate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editDateVal) return;
    setIsEditingOrderDate(false);
    setSaveStatus('Updating start date...');
    // Ensure all current rows are saved before shifting order date
    await onSaveRowsToServer(rows);
    onUpdateCurrentDC({
      ...challan,
      orderDate: editDateVal,
    });
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // Compute the next consecutive date preview for the "+ Add Next Date" button
  const nextDatePreview = useMemo(() => {
    if (rows.length === 0) {
      return parsedOrderDate.display;
    }
    const sorted = [...rows].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );
    const lastRow = sorted[sorted.length - 1];
    const nextDStr = getNextDateString(lastRow.dateStr);
    return formatDayLabel(nextDStr);
  }, [rows, parsedOrderDate]);

  // Robust check for Opening Lot Day (Day 1 of the Delivery Challan)
  const isOpeningRowCheck = useCallback(
    (r: PlanningRow, idx: number): boolean => {
      const rowClean = (r.dateStr || '').trim().split('T')[0];
      const orderClean = (parsedOrderDate.formatted || '').trim().split('T')[0];
      if (rowClean && orderClean && rowClean === orderClean) return true;
      if (
        Number(r.year) === Number(parsedOrderDate.year) &&
        Number(r.month) === Number(parsedOrderDate.month)
      ) {
        if (Number(r.dayNumber) === Number(parsedOrderDate.day) || idx === 0) {
          return true;
        }
      }
      if (
        r.qty !== null &&
        r.qty !== undefined &&
        Number(r.qty) > 0 &&
        Number(r.qty) === Number(challan.openingQty)
      ) {
        return true;
      }
      if (idx === 0 && (!orderClean || rowClean <= orderClean)) {
        return true;
      }
      return false;
    },
    [parsedOrderDate, challan.openingQty]
  );

  // Pure Manufacturing Planning Balance & Expected vs Actual Difference Calculation
  // Supports continuous multi-month timeline (e.g. 20-Nov through 15-Dec)
  const { updatedRows, totals } = useMemo(() => {
    let curBal = challan.openingQty || 0;
    let totInput = challan.openingQty || 0;
    let totExpected = 0;
    let totActual = 0;
    let lastActiveDateStr: string | null = null;
    let daysWithOutput = 0;

    // Strict chronological sort by date timestamp
    const sorted = [...rows].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );
    const calculated: PlanningRow[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const isOpeningLotDay = isOpeningRowCheck(row, i);

      // First active row of the order receives opening lot QTY plus any Day 1 extra input
      if (isOpeningLotDay && i === 0) {
        const day1ExtraInput =
          row.inputQty !== null && row.inputQty !== undefined && Number(row.inputQty) > 0
            ? Number(row.inputQty)
            : 0;
        const totalOpeningLot = (challan.openingQty || 0) + day1ExtraInput;
        curBal = totalOpeningLot;
        totInput = totalOpeningLot;
      } else if (
        row.inputQty !== null &&
        row.inputQty !== undefined &&
        Number(row.inputQty) > 0
      ) {
        // Buyer added more QTY on this date!
        const extra = Number(row.inputQty);
        totInput += extra;
        curBal += extra;
      }

      // Expected output quota
      if (
        row.expectedOutput !== null &&
        row.expectedOutput !== undefined &&
        Number(row.expectedOutput) > 0
      ) {
        totExpected += Number(row.expectedOutput);
      }

      // Calculate calendar day gap from last active output date (or order start date)
      let calculatedGap = 0;
      if (
        row.actualOutput !== null &&
        row.actualOutput !== undefined &&
        Number(row.actualOutput) > 0
      ) {
        if (lastActiveDateStr) {
          // Gap between consecutive output dates
          const prevTime = new Date(lastActiveDateStr).getTime();
          const currTime = new Date(row.dateStr).getTime();
          const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
          calculatedGap = Math.max(0, diffDays - 1);
        } else {
          // Gap from order start date to the FIRST actual output date
          const orderStartStr = sorted[0]?.dateStr || challan.orderDate;
          if (orderStartStr) {
            const orderStartTime = new Date(orderStartStr).getTime();
            const currTime = new Date(row.dateStr).getTime();
            const diffDays = Math.round((currTime - orderStartTime) / (1000 * 60 * 60 * 24));
            calculatedGap = diffDays;
          }
        }
        lastActiveDateStr = row.dateStr;
      }

      // Actual output achieved
      if (row.actualOutput !== null && row.actualOutput !== undefined) {
        const actual = Number(row.actualOutput);
        totActual += actual;
        if (actual > 0) {
          daysWithOutput++;
        }
        curBal = Math.max(0, curBal - actual);
      }

      const isZero = curBal === 0 && (totActual > 0 || totInput > 0);

      // Explicit Stitching Status on row or automatic default
      let rowStatus: StitchingStatus = row.status || 'Process';
      if (!row.status) {
        if (isZero) {
          rowStatus = 'Complete';
        } else if ((row.actualOutput || 0) > 0) {
          rowStatus = 'Inline';
        } else {
          rowStatus = 'Process';
        }
      }

      calculated.push({
        ...row,
        expectedOutput: row.expectedOutput,
        actualOutput: row.actualOutput,
        daysGap: row.daysGap && row.daysGap > 0 ? row.daysGap : calculatedGap,
        balance: curBal,
        isZeroBalance: isZero,
        status: rowStatus,
      });
    }

    const variance = totExpected - totActual;
    const netDifference = totActual - totExpected; // Actual minus Expected!
    const completionRate =
      totInput > 0 ? Math.min(100, Math.round((totActual / totInput) * 100)) : 0;
    const averageDailyOutput =
      daysWithOutput > 0 ? Math.round(totActual / daysWithOutput) : 0;

    return {
      updatedRows: calculated,
      totals: {
        targetInput: totInput,
        totalExtraInput: Math.max(0, totInput - challan.openingQty),
        totalExpectedOutput: totExpected,
        totalActualOutput: totActual,
        currentBalance: curBal,
        variance,
        netDifference,
        averageDailyOutput,
        completionRate,
      },
    };
  }, [rows, challan.openingQty, challan.orderDate, isOpeningRowCheck]);

  // Auto-schedule expected quota calculation helper
  // Divides available balance by daily target rate, skips Sundays, remainder on final day
  const autoScheduleExpectedQuota = useCallback(
    (
      currentRows: PlanningRow[],
      startRowId: string,
      targetRate: number,
      startingBalance: number
    ): {
      updatedRowsList: PlanningRow[];
      scheduledDays: number;
      remainder: number;
      endDayLabel: string;
    } => {
      let list = [...currentRows].sort(
        (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
      );
      let targetIdx = list.findIndex((r) => r.id === startRowId);
      if (targetIdx === -1 || targetRate <= 0 || startingBalance <= 0) {
        return { updatedRowsList: currentRows, scheduledDays: 0, remainder: 0, endDayLabel: '' };
      }

      // If requested starting row is Day 1 (the initial opening day), lock Day 1 and start from Day 2!
      if (targetIdx === 0) {
        list[0] = { ...list[0], expectedOutput: null };
        targetIdx = 1;
        if (list.length <= 1) {
          list = addNextDayToRows(challan, list);
        }
      }

      const daysNeeded = Math.ceil(startingBalance / targetRate);
      let remainingQuota = startingBalance;
      let workingDaysAllocated = 0;
      let currIdx = targetIdx;
      let endDayLabel = '';
      let iterations = 0;
      const maxIterations = 180;

      while (remainingQuota > 0 && workingDaysAllocated < daysNeeded && iterations < maxIterations) {
        iterations++;
        if (currIdx >= list.length) {
          list = addNextDayToRows(challan, list);
        }

        const row = list[currIdx];
        const dayInfo = getCalendarDayInfo(row.dateStr);
        const isSunday = dayInfo.isSunday;

        if (isSunday) {
          list[currIdx] = { ...row, expectedOutput: null };
          currIdx++;
          continue;
        }

        workingDaysAllocated++;
        endDayLabel = row.dayLabel || row.dateStr;

        if (workingDaysAllocated === daysNeeded || remainingQuota <= targetRate) {
          list[currIdx] = { ...row, expectedOutput: remainingQuota };
          remainingQuota = 0;
        } else {
          list[currIdx] = { ...row, expectedOutput: targetRate };
          remainingQuota -= targetRate;
        }

        currIdx++;
      }

      const finalRemainder = startingBalance - targetRate * (workingDaysAllocated - 1);

      return {
        updatedRowsList: list,
        scheduledDays: workingDaysAllocated,
        remainder: finalRemainder > 0 && finalRemainder !== targetRate ? finalRemainder : 0,
        endDayLabel,
      };
    },
    [challan]
  );

  const handleUndoAutoSchedule = () => {
    if (!autoScheduleNotification) return;
    const prevMap = new Map(
      autoScheduleNotification.previousExpectedRows.map((p) => [p.id, p.val])
    );
    const reverted = rows.map((r) => {
      if (prevMap.has(r.id)) {
        return { ...r, expectedOutput: prevMap.get(r.id) ?? null };
      }
      return r;
    });
    setRows(reverted);
    setAutoScheduleNotification(null);
    saveCompletePlanToSupabase(reverted);
  };

  const handleClearSchedule = () => {
    const cleared = rows.map((r) => ({ ...r, expectedOutput: null }));
    setRows(cleared);
    setAutoScheduleNotification(null);
    saveCompletePlanToSupabase(cleared);
  };

  const handleResetEntireLedger = async () => {
    if (
      !window.confirm(
        `Reset Ledger for DC #${challan.dcNo}?\n\nThis will clear any auto-generated or glitch entries and restore a clean month register. Day 1 remains locked for opening stock arrival, and all daily outputs can be entered manually.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('Resetting ledger entries...');
    try {
      const freshRows = await resetChallanPlanningEntries(challan, year, month);
      setRows(freshRows);
      setAutoScheduleNotification(null);
      setHasUnsavedChanges(false);
      setIsSaving(false);
      setSaveStatus('Ledger cleanly reset!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Reset error:', err);
      setIsSaving(false);
      setSaveStatus('Failed to reset ledger');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle cell value changes immediately in state, with debounced auto-save to Supabase
  const handleCellChange = (
    rowId: string,
    field: 'inputQty' | 'expectedOutput' | 'actualOutput' | 'buyerNotes' | 'status',
    value: string
  ) => {
    // Strict Lock Enforcement: Day 1 (Opening Lot), prep days, and Sundays are locked for output
    if (field === 'expectedOutput' || field === 'actualOutput') {
      const targetRow = rows.find((r) => r.id === rowId);
      if (targetRow) {
        const isOpening = isOpeningRowCheck(targetRow, rows.indexOf(targetRow));
        const dayInfo = getCalendarDayInfo(targetRow.dateStr);
        const expStart = challan.firstExpectedDate ? challan.firstExpectedDate.split('T')[0] : null;
        const isPrep = Boolean(expStart && targetRow.dateStr < expStart);
        if (isOpening || isPrep || dayInfo.isSunday) {
          // Locked cells cannot be modified
          return;
        }
      }
    }

    const numVal = value.trim() === '' ? null : isNaN(Number(value)) ? null : Math.max(0, Number(value));
    let nextRows = rows.map((r) => {
      if (r.id !== rowId) return r;

      if (field === 'status') {
        return { ...r, status: value as StitchingStatus };
      }

      if (field === 'buyerNotes') {
        return { ...r, buyerNotes: value.trim() === '' ? null : value };
      }

      if (field === 'inputQty') {
        return { ...r, inputQty: numVal };
      }
      if (field === 'expectedOutput') {
        return { ...r, expectedOutput: numVal };
      }
      if (field === 'actualOutput') {
        return { ...r, actualOutput: numVal };
      }
      return r;
    });

    setRows(nextRows);
    setHasUnsavedChanges(true);

    // If changing row status, immediately sync with DC status & save to Supabase
    if (field === 'status') {
      const newStatus = value as StitchingStatus;
      onUpdateCurrentDC({
        ...challan,
        status: newStatus,
      });
      saveCompletePlanToSupabase(nextRows);
      return;
    }

    // Debounce auto-save to Supabase after 600ms of user typing
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setSaveStatus('Unsaved changes...');
    autoSaveTimerRef.current = setTimeout(() => {
      saveCompletePlanToSupabase(nextRows);
    }, 600);
  };

  // Immediate save on blur
  const handleCellBlur = () => {
    if (hasUnsavedChanges) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      saveCompletePlanToSupabase(rows);
    }
  };

  // 1-Click: Mark entire lot complete and persist everything to Supabase
  const handleMarkLotComplete = async () => {
    const completeStatus: StitchingStatus = 'Complete';
    onUpdateCurrentDC({
      ...challan,
      status: completeStatus,
    });

    const updated = rows.map((r, idx) => {
      if (idx === rows.length - 1 || r.balance === 0 || (r.actualOutput || 0) > 0) {
        return { ...r, status: completeStatus };
      }
      return r;
    });

    setRows(updated);
    await saveCompletePlanToSupabase(updated);
    setSaveStatus('Lot marked Complete and saved successfully!');
  };

  // 1-Click: Add Next Consecutive Day (Handles month boundary: 30-Nov -> 1-Dec!)
  const handleAddNextDay = async () => {
    const nextList = addNextDayToRows(challan, rows);
    setRows(nextList);
    setSaveStatus('Adding next day...');
    await saveCompletePlanToSupabase(nextList);
  };

  // Continue production after 30th/31st into the next month
  // Matches user example: from 20th Nov through 15th Dec
  const handleContinueToNextMonth = async (customEndDate?: string) => {
    if (rows.length === 0) return;

    const sorted = [...rows].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );
    const lastRow = sorted[sorted.length - 1];

    let targetDate = customEndDate;
    if (!targetDate && lastRow) {
      // Default to 15th of the next month (e.g. 2026-12-15)
      const parts = lastRow.dateStr.split('-').map(Number);
      let nextM = parts[1] + 1;
      let nextY = parts[0];
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      targetDate = `${nextY}-${String(nextM).padStart(2, '0')}-15`;
    }

    if (!targetDate) return;

    const nextList = extendRowsThroughDate(challan, rows, targetDate);
    setRows(nextList);
    setIsContinueModalOpen(false);
    setSaveStatus('Continuing to next month...');
    await saveCompletePlanToSupabase(nextList);
  };

  // Quick preset: Continue full next month (adds 30 days)
  const handleContinueFullNextMonth = async () => {
    if (rows.length === 0) return;
    const sorted = [...rows].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );
    const lastRow = sorted[sorted.length - 1];
    const parts = lastRow.dateStr.split('-').map(Number);
    let nextM = parts[1] + 1;
    let nextY = parts[0];
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const daysInNextM = new Date(nextY, nextM, 0).getDate();
    const targetDate = `${nextY}-${String(nextM).padStart(2, '0')}-${String(daysInNextM).padStart(2, '0')}`;
    await handleContinueToNextMonth(targetDate);
  };

  // Quick preset: Add 7 Days
  const handleAdd7Days = async () => {
    if (rows.length === 0) return;
    let current = [...rows];
    for (let i = 0; i < 7; i++) {
      current = addNextDayToRows(challan, current);
    }
    setRows(current);
    setIsContinueModalOpen(false);
    await saveCompletePlanToSupabase(current);
  };

  // Delete an added continued row
  const handleRemoveRow = async (rowId: string) => {
    if (rows.length <= 1) return;
    const nextList = rows.filter((r) => r.id !== rowId);
    setRows(nextList);
    await saveCompletePlanToSupabase(nextList);
  };

  // Change Status directly from ledger header
  const handleStatusChange = async (newStatus: StitchingStatus) => {
    onUpdateCurrentDC({
      ...challan,
      status: newStatus,
    });
    // Also save current rows to ensure full persistence
    await saveCompletePlanToSupabase();
  };

  // Month Navigation
  const handlePrevMonth = () => {
    if (month === 1) {
      onMonthChange(12);
      onYearChange(year - 1);
    } else {
      onMonthChange(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onMonthChange(1);
      onYearChange(year + 1);
    } else {
      onMonthChange(month + 1);
    }
  };

  // Jump directly to order start month
  const handleJumpToOrderMonth = () => {
    onYearChange(parsedOrderDate.year);
    onMonthChange(parsedOrderDate.month);
  };



  const isBeforeOrderDate =
    year < parsedOrderDate.year ||
    (year === parsedOrderDate.year && month < parsedOrderDate.month);

  const getStatusBadgeStyle = (status: StitchingStatus) => {
    switch (status) {
      case 'Process':
        return 'bg-amber-100 text-amber-900 border-amber-300 ring-amber-500/20';
      case 'Inline':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300 ring-indigo-500/20';
      case 'Complete':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-emerald-500/20';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 ring-slate-500/20';
    }
  };

  // Find if rows span across multiple months
  const distinctMonths = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      s.add(`${r.year}-${r.month}`);
    });
    return s.size;
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* Top DC Master Information Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bg-slate-900 text-sky-400 font-mono font-black text-sm px-2.5 py-1 rounded tracking-wide shadow-xs">
                DC #{challan.dcNo}
              </span>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {challan.party}
              </h1>

              {/* Status Dropdown in DC Header */}
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Status:
                </span>
                <select
                  value={challan.status}
                  onChange={(e) => handleStatusChange(e.target.value as StitchingStatus)}
                  className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 ${getStatusBadgeStyle(
                    challan.status
                  )}`}
                  title="Update stitching status"
                >
                  <option value="Process">⏳ Process</option>
                  <option value="Inline">⚡ Inline</option>
                  <option value="Complete">✅ Complete</option>
                </select>
              </div>

              {/* Real-time Live Sync Indicator */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                  isLiveConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title={isLiveConnected ? 'Connected to Supabase - Live real-time updates active across managers, admins & users' : 'Connecting to live sync...'}
              >
                <span className="relative flex h-2 w-2">
                  {isLiveConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isLiveConnected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  ></span>
                </span>
                <span>{isLiveConnected ? 'Live Sync' : 'Connecting...'}</span>
                {lastLiveSyncTime && isLiveConnected && (
                  <span className="text-[10px] text-emerald-600 font-mono hidden sm:inline">
                    {lastLiveSyncTime}
                  </span>
                )}
              </div>

              {onManualSync && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsManualSyncing(true);
                    await onManualSync();
                    setTimeout(() => setIsManualSyncing(false), 500);
                  }}
                  title="Force refresh latest data from Supabase"
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin text-sky-600' : ''}`} />
                </button>
              )}

              {saveStatus && (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>{saveStatus}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
              <span>
                Article: <strong className="text-slate-800">{challan.article}</strong>
              </span>
              {challan.item && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    <Shirt className="w-3 h-3 text-sky-600" />
                    <span>Item: <strong>{challan.item}</strong></span>
                  </span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                {isEditingOrderDate ? (
                  <form
                    onSubmit={handleSaveOrderDate}
                    className="inline-flex items-center gap-1.5 bg-sky-50 px-2 py-0.5 rounded border border-sky-300 shadow-2xs"
                  >
                    <span className="text-[11px] font-bold text-sky-900">Start Date:</span>
                    <input
                      type="date"
                      value={editDateVal}
                      onChange={(e) => setEditDateVal(e.target.value)}
                      className="text-xs bg-white text-slate-900 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-2 py-0.5 bg-sky-600 text-white rounded text-[11px] font-bold hover:bg-sky-500 cursor-pointer shadow-2xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingOrderDate(false)}
                      className="px-1 text-slate-500 hover:text-slate-700 text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <span
                    onClick={() => {
                      setEditDateVal(parsedOrderDate.formatted);
                      setIsEditingOrderDate(true);
                    }}
                    className="group inline-flex items-center gap-1 cursor-pointer"
                    title="Click to change order start date"
                  >
                    <span>Order Start Date:</span>
                    <strong className="text-slate-900 font-mono bg-sky-50 group-hover:bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200 transition-colors inline-flex items-center gap-1">
                      {parsedOrderDate.display}
                      <Pencil className="w-3 h-3 text-sky-500 group-hover:text-sky-700" />
                    </strong>
                  </span>
                )}
              </span>
              <span>•</span>
              <span>
                Opening QTY:{' '}
                <strong className="text-slate-900 font-mono font-bold">
                  {challan.openingQty.toLocaleString()} pcs
                </strong>
              </span>
              {challan.notes && (
                <>
                  <span>•</span>
                  <span className="text-slate-500 italic max-w-xs truncate">
                    &ldquo;{challan.notes}&rdquo;
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Header Actions: Print / PDF & Export */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Print Register / Save as PDF"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Print / PDF Report</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportRegisterToExcel({
                  challan,
                  rows: updatedRows,
                  totals,
                  monthName: FULL_MONTH_NAMES[month - 1],
                  year,
                  scope: 'all_dates',
                  userName: currentUser?.fullName || 'Manager',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Export Full Register to Styled Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Month Navigation Ribbon */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Production Month:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1 hover:bg-white rounded transition-colors text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={month}
                onChange={(e) => onMonthChange(parseInt(e.target.value, 10))}
                className="bg-white font-bold text-slate-900 border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
              >
                {FULL_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
                className="bg-white font-bold text-slate-900 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none cursor-pointer font-mono"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1 hover:bg-white rounded transition-colors text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {distinctMonths > 1 && (
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Multi-Month Continuous Production Active ({distinctMonths} months)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Start Day:{' '}
              <strong className="text-slate-800">
                {parsedOrderDate.day} {MONTH_NAMES[parsedOrderDate.month - 1]}
              </strong>
            </span>
            <button
              onClick={handleJumpToOrderMonth}
              className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded px-2.5 py-1 transition-colors cursor-pointer"
            >
              Order Month ({MONTH_NAMES[parsedOrderDate.month - 1]} {parsedOrderDate.year})
            </button>
          </div>
        </div>
      </div>

      {/* Warning if viewing a month before order placement */}
      {isBeforeOrderDate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">
                No production before Order Date ({parsedOrderDate.display})
              </p>
              <p className="text-amber-700 mt-0.5">
                This Delivery Challan was registered on {parsedOrderDate.display}. Days
                prior to order date have no manufacturing activity.
              </p>
            </div>
          </div>
          <button
            onClick={handleJumpToOrderMonth}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
          >
            Go to {MONTH_NAMES[parsedOrderDate.month - 1]} {parsedOrderDate.year}
          </button>
        </div>
      )}

      {/* Summary KPI Cards (INCLUDING EXPECTED VS ACTUAL DIFFERENCE) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Input */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Input
          </span>
          <p className="mt-1 text-xl font-black font-mono tabular-nums text-sky-700">
            {totals.targetInput.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">
            {totals.totalExtraInput > 0
              ? `Initial + ${totals.totalExtraInput.toLocaleString()} extra`
              : 'Opening lot quantity'}
          </span>
        </div>

        {/* Expected Output */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Expected Output
          </span>
          <p className="mt-1 text-xl font-black font-mono tabular-nums text-indigo-700">
            {totals.totalExpectedOutput.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Scheduled production quota</span>
        </div>

        {/* Actual Output */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Actual Output
          </span>
          <p className="mt-1 text-xl font-black font-mono tabular-nums text-emerald-700">
            {totals.totalActualOutput.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Floor realized output</span>
        </div>

        {/* NET DIFFERENCE (ACTUAL - EXPECTED) */}
        <div
          className={`border rounded-xl p-3.5 shadow-xs transition-colors ${
            totals.netDifference > 0
              ? 'bg-emerald-50/70 border-emerald-200'
              : totals.netDifference < 0
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Output Difference
            </span>
            {totals.netDifference > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            ) : totals.netDifference < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            ) : null}
          </div>
          <p
            className={`mt-1 text-xl font-black font-mono tabular-nums ${
              totals.netDifference > 0
                ? 'text-emerald-700'
                : totals.netDifference < 0
                ? 'text-rose-700'
                : 'text-slate-700'
            }`}
          >
            {totals.netDifference > 0
              ? `+${totals.netDifference.toLocaleString()}`
              : totals.netDifference.toLocaleString()}{' '}
            <span className="text-xs font-semibold">pcs</span>
          </p>
          <span
            className={`text-[10px] font-bold ${
              totals.netDifference > 0
                ? 'text-emerald-700'
                : totals.netDifference < 0
                ? 'text-rose-700'
                : 'text-slate-500'
            }`}
          >
            {totals.netDifference > 0
              ? 'Ahead of quota'
              : totals.netDifference < 0
              ? 'Production shortfall'
              : 'Even with quota'}
          </span>
        </div>

        {/* Remaining Balance */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Remaining Balance
          </span>
          <p
            className={`mt-1 text-xl font-black font-mono tabular-nums ${
              totals.currentBalance === 0 ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {totals.currentBalance.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">
            {totals.currentBalance === 0 ? 'Lot Complete!' : 'Pending balance'}
          </span>
        </div>

        {/* Completion Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Completion Rate
          </span>
          <p className="mt-1 text-xl font-black font-mono tabular-nums text-indigo-600">
            {totals.completionRate}%
          </p>
          <span className="text-[10px] text-slate-400">
            Avg {totals.averageDailyOutput.toLocaleString()} pcs/day
          </span>
        </div>
      </div>

      {/* Date-Wise Production Register Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Date-Wise Production Register ({FULL_MONTH_NAMES[month - 1]} {year})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">
              Starts on <strong>{parsedOrderDate.display}</strong>. Running balance carries forward
              continuously past month ends.
            </span>
            <button
              onClick={() => saveCompletePlanToSupabase()}
              disabled={isSaving}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="Save all changes"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  <span>{hasUnsavedChanges ? 'Save Plan *' : 'Save Plan'}</span>
                </>
              )}
            </button>
            <button
              onClick={handleAddNextDay}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-sky-600" />
              <span>+ Add Day</span>
            </button>
            <button
              onClick={() => setIsContinueModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowRightCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span>Continue Next Month</span>
            </button>
            <div className="h-4 w-px bg-slate-300 mx-0.5 hidden sm:block" />
            <button
              type="button"
              onClick={() => {
                const autoRows = generateAutoScheduledRows(challan);
                setRows(autoRows);
                saveCompletePlanToSupabase(autoRows);
                setSaveStatus('Auto-scheduled quota generated!');
                setTimeout(() => setSaveStatus(null), 3000);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Automatically calculate and populate daily expected quotas for all days"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto-Fill Quotas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all expected output values for this DC?')) {
                  handleClearSchedule();
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Clear expected output values for all days to enter manually"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Clear Expected</span>
            </button>
            <button
              type="button"
              onClick={handleResetEntireLedger}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Reset ledger to clean starting state and remove any glitch rows"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Reset Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Print Sheet / PDF Report"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Print Sheet / PDF</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportRegisterToExcel({
                  challan,
                  rows: updatedRows,
                  totals,
                  monthName: FULL_MONTH_NAMES[month - 1],
                  year,
                  scope: 'current_month',
                  userName: currentUser?.fullName || 'Manager',
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Export Current Month to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
            {lastSavedTime && !hasUnsavedChanges && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                Saved {lastSavedTime}
              </span>
            )}
          </div>
        </div>

        {/* Auto-Schedule Notification Banner with Undo Option */}
        {autoScheduleNotification && (
          <div className="bg-sky-50 border-b border-sky-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="text-sky-950 font-medium">
                <strong>Auto-Scheduled Expected Output:</strong> {autoScheduleNotification.days} working days at{' '}
                <strong>{autoScheduleNotification.rate.toLocaleString()} pcs/day</strong>
                {autoScheduleNotification.remainder > 0 && (
                  <span> (Final day remainder: <strong>{autoScheduleNotification.remainder.toLocaleString()} pcs</strong>)</span>
                )}
                {autoScheduleNotification.endDateLabel && (
                  <span> • Estimated Completion: <strong>{autoScheduleNotification.endDateLabel}</strong></span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndoAutoSchedule}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                Undo Auto-Fill
              </button>
              <button
                type="button"
                onClick={() => setAutoScheduleNotification(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1150px]">
            <thead className="bg-slate-100/95 border-b border-slate-300 text-slate-800 font-extrabold uppercase text-xs sm:text-[13px] tracking-wider divide-x divide-slate-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-3 px-3 text-center w-28">Date</th>
                <th className="py-3 px-2 text-center w-16">Day</th>
                <th className="py-3 px-3 text-center w-24">DC #</th>
                <th className="py-3 px-3 text-right w-28">QTY</th>
                <th className="py-3 px-3 text-right w-32">INPUT</th>
                <th className="py-3 px-2 text-center w-20">DAYS GAP</th>
                <th className="py-3 px-3 text-right w-40 bg-indigo-50/70 text-indigo-950 font-black">
                  EXPECTED OUTPUT
                </th>
                <th className="py-3 px-3 text-right w-40 bg-emerald-50/70 text-emerald-950 font-black">
                  ACTUAL OUTPUT
                </th>
                {/* CALCULATION OF EXPECTED AND ACTUAL DIFFERENCE */}
                <th className="py-3 px-3 text-right w-36 bg-sky-50 text-sky-950 font-black">
                  DIFF (ACTUAL - EXP)
                </th>
                <th className="py-3 px-3 text-right w-36 bg-slate-200/80 text-slate-900 font-black">
                  BALANCE
                </th>
                {/* STATUS COLUMN (DROPDOWN MENU: Process | Inline | Complete) */}
                <th className="py-3 px-3 text-center w-36 bg-amber-50/80 text-amber-950 font-black">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {updatedRows.map((row, index) => {
                const isZeroRow = row.isZeroBalance;
                const dayInfo = getCalendarDayInfo(row.dateStr);
                const dayOfWeek = dayInfo.dayOfWeek;
                const isSunday = dayInfo.isSunday;
                const isSaturday = dayInfo.isSaturday;

                // Daily difference calculation between Actual and Expected
                const hasActual =
                  row.actualOutput !== null &&
                  row.actualOutput !== undefined &&
                  row.actualOutput !== 0;
                const hasExpected =
                  row.expectedOutput !== null &&
                  row.expectedOutput !== undefined &&
                  row.expectedOutput !== 0;
                const hasValues = hasActual || hasExpected;
                const dailyDiff = (row.actualOutput || 0) - (row.expectedOutput || 0);

                const isOpeningLotDay = isOpeningRowCheck(row, index);
                const isFirstRowOfOrder = isOpeningLotDay;

                const expectedStartDate = challan.firstExpectedDate ? challan.firstExpectedDate.split('T')[0] : null;
                const isBeforeExpectedDate = Boolean(expectedStartDate && row.dateStr < expectedStartDate);

                // Month boundary transition check (e.g. from 30-Nov to 1-Dec)
                const prevRow = index > 0 ? updatedRows[index - 1] : null;
                const isNewMonthSection =
                  prevRow &&
                  (prevRow.month !== row.month || prevRow.year !== row.year);

                const currentStatus = row.status || 'Process';

                return (
                  <React.Fragment key={row.id}>
                    {/* Visual Month Transition Header when production continues into next month! */}
                    {isNewMonthSection && (
                      <tr className="bg-sky-50/90 border-y-2 border-sky-300">
                        <td
                          colSpan={11}
                          className="py-2 px-4 text-sky-950 font-bold text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-sky-700" />
                              <span>
                                Continued Production into{' '}
                                <strong>
                                  {FULL_MONTH_NAMES[row.month - 1]} {row.year}
                                </strong>
                              </span>
                            </span>
                            <span className="text-[11px] font-mono text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded border border-sky-300 font-bold">
                              Carried Forward Balance:{' '}
                              <strong>{prevRow.balance.toLocaleString()} pcs</strong>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    <tr
                      className={`divide-x divide-slate-200 transition-colors ${
                        isZeroRow
                          ? 'bg-[#ffe4de] text-rose-950 font-semibold'
                          : isSunday
                          ? 'bg-slate-50/70'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{row.dayLabel}</span>
                          {/* Show small delete button if row is past order month */}
                          {index >= 30 && (
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              title="Remove this extra date row"
                              className="text-slate-300 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Day */}
                      <td
                        className={`py-3 px-2 text-center font-bold text-xs sm:text-sm ${
                          isSunday
                            ? 'text-rose-600 bg-rose-50/40'
                            : isSaturday
                            ? 'text-indigo-900 bg-indigo-50/20 font-black'
                            : 'text-slate-600'
                        }`}
                      >
                        {dayOfWeek}
                      </td>

                      {/* DC # (Shown on the first day of the order) */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-xs sm:text-sm text-slate-800">
                        {isFirstRowOfOrder ? challan.dcNo : ''}
                      </td>

                      {/* QTY (Initial Opening Qty on the first day of the order) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 font-bold text-xs sm:text-sm">
                        {isFirstRowOfOrder ? challan.openingQty.toLocaleString() : ''}
                      </td>

                      {/* INPUT */}
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          placeholder="—"
                          value={
                            row.inputQty !== null && row.inputQty !== undefined
                              ? row.inputQty
                              : ''
                          }
                          onChange={(e) => handleCellChange(row.id, 'inputQty', e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className={`w-28 sm:w-32 px-2.5 py-1.5 text-xs sm:text-sm border rounded text-right font-mono font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white transition-all ${
                            (row.inputQty || 0) > 0
                              ? 'border-sky-400 text-sky-950 bg-sky-50/70'
                              : 'border-slate-300 text-slate-700'
                          }`}
                        />
                      </td>

                      {/* DAYS GAP */}
                      <td className="py-3 px-2 text-center font-mono tabular-nums text-xs sm:text-sm">
                        {row.daysGap && row.daysGap > 0 ? (
                          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-black text-xs">
                            {row.daysGap}d
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* EXPECTED OUTPUT */}
                      <td className="py-2.5 px-2 text-right">
                        {isOpeningLotDay ? (
                          <div
                            title="Day 1 initial lot arrival is strictly locked"
                            className="w-32 sm:w-36 px-2.5 py-1.5 text-xs text-center border rounded font-mono font-bold bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none"
                          >
                            🔒 Opening Lot
                          </div>
                        ) : isBeforeExpectedDate ? (
                          <div
                            title="Line prep lead time"
                            className="w-32 sm:w-36 px-2.5 py-1.5 text-xs text-center border border-dashed rounded font-mono font-bold bg-slate-50 text-slate-400 border-slate-300 cursor-not-allowed select-none"
                          >
                            🔒 Line Prep
                          </div>
                        ) : isSunday ? (
                          <div
                            title="Sunday is factory off-day"
                            className="w-32 sm:w-36 px-2.5 py-1.5 text-xs text-center border rounded font-mono font-bold bg-rose-50 text-rose-500 border-rose-200 cursor-not-allowed select-none"
                          >
                            OFF (Sun)
                          </div>
                        ) : (
                          <input
                            type="number"
                            placeholder="—"
                            value={
                              row.expectedOutput !== null && row.expectedOutput !== undefined
                               ? row.expectedOutput
                                : ''
                            }
                            onChange={(e) =>
                              handleCellChange(row.id, 'expectedOutput', e.target.value)
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className={`w-32 sm:w-36 px-2.5 py-1.5 text-xs sm:text-sm border rounded text-right font-mono font-bold transition-all ${
                              (row.expectedOutput || 0) > 0
                                ? 'border-indigo-400 text-indigo-950 bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
                                : 'border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
                            }`}
                          />
                        )}
                      </td>

                      {/* ACTUAL OUTPUT */}
                      <td className="py-2.5 px-2 text-right">
                        {isOpeningLotDay ? (
                          <div
                            title="Day 1 initial lot arrival is strictly locked"
                            className="w-32 sm:w-36 px-2.5 py-1.5 text-xs text-center border rounded font-mono font-bold bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none"
                          >
                            🔒 Opening Lot
                          </div>
                        ) : isBeforeExpectedDate ? (
                          <div
                            title="Line prep lead time"
                            className="w-32 sm:w-36 px-2.5 py-1.5 text-xs text-center border border-dashed rounded font-mono font-bold bg-slate-50 text-slate-400 border-slate-300 cursor-not-allowed select-none"
                          >
                            🔒 Line Prep
                          </div>
                        ) : isSunday ? (
                          <div
                            title="Sunday is factory off-day"
                            className="w-32 sm:w-36 px-2.5 py-1.5 text-xs text-center border rounded font-mono font-bold bg-rose-50 text-rose-500 border-rose-200 cursor-not-allowed select-none"
                          >
                            OFF (Sun)
                          </div>
                        ) : (
                          <input
                            type="number"
                            placeholder="—"
                            value={
                              row.actualOutput !== null && row.actualOutput !== undefined
                                ? row.actualOutput
                                : ''
                            }
                            onChange={(e) =>
                              handleCellChange(row.id, 'actualOutput', e.target.value)
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className={`w-32 sm:w-36 px-2.5 py-1.5 text-xs sm:text-sm border rounded text-right font-mono font-bold transition-all ${
                              (row.actualOutput || 0) > 0
                                ? 'border-emerald-500 text-emerald-950 bg-emerald-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'
                                : 'border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'
                            }`}
                          />
                        )}
                      </td>

                      {/* CALCULATION OF EXPECTED AND ACTUAL DIFFERENCE (DIFF = ACTUAL - EXPECTED) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs sm:text-sm">
                        {hasValues ? (
                          <span
                            className={`inline-block px-2.5 py-1 rounded font-black text-xs sm:text-sm ${
                              dailyDiff > 0
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : dailyDiff < 0
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {dailyDiff > 0 ? `+${dailyDiff.toLocaleString()}` : dailyDiff.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* BALANCE */}
                      <td
                        className={`py-3 px-3 text-right font-mono font-black text-sm sm:text-base tabular-nums ${
                          isZeroRow
                            ? 'text-rose-950 font-black'
                            : row.balance === 0
                            ? 'text-emerald-600 font-black'
                            : 'text-slate-900'
                        }`}
                      >
                        {row.balance.toLocaleString()}
                      </td>

                      {/* STITCHING STATUS (INLINE DROPDOWN MENU: Process | Inline | Complete) */}
                      <td className="py-2 px-2 text-center">
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            handleCellChange(row.id, 'status', e.target.value)
                          }
                          className={`w-full max-w-[130px] px-2.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs transition-colors ${
                            currentStatus === 'Complete'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200'
                              : currentStatus === 'Inline'
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-400 hover:bg-indigo-200'
                              : 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200'
                          }`}
                          title="Select Status for this date"
                        >
                          <option
                            value="Process"
                            className="bg-white text-slate-900 font-bold"
                          >
                            ⏳ Process
                          </option>
                          <option
                            value="Inline"
                            className="bg-white text-slate-900 font-bold"
                          >
                            ⚡ Inline
                          </option>
                          <option
                            value="Complete"
                            className="bg-white text-slate-900 font-bold"
                          >
                            ✅ Complete
                          </option>
                        </select>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* ACTION ROW: Add More Dates / Continue to Next Month */}
              {updatedRows.length > 0 && (
                <tr className="bg-slate-50/90 border-t-2 border-dashed border-slate-300">
                  <td colSpan={11} className="py-3 px-4 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <span className="text-xs font-semibold text-slate-600">
                        Production continuing past {updatedRows[updatedRows.length - 1]?.dayLabel}?
                      </span>
                      <button
                        onClick={handleAddNextDay}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Add the next single calendar day"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>+ Add Next Date ({nextDatePreview})</span>
                      </button>
                      <button
                        onClick={() => setIsContinueModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Extend production past 30th/31st into the next month"
                      >
                        <CalendarRange className="w-3.5 h-3.5" />
                        <span>+ Continue to Next Month (e.g. through 15th)</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {updatedRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-500 bg-slate-50">
                    <p className="font-semibold text-slate-700">
                      No production days for {FULL_MONTH_NAMES[month - 1]} {year}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      This order was placed on <strong>{parsedOrderDate.display}</strong>.
                    </p>
                    <button
                      onClick={handleJumpToOrderMonth}
                      className="mt-3 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Jump to Order Month ({MONTH_NAMES[parsedOrderDate.month - 1]} {parsedOrderDate.year})
                    </button>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Bottom Sticky Totals Row with Output Difference Total */}
            {updatedRows.length > 0 && (
              <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900 divide-x divide-slate-200">
                <tr>
                  <td
                    colSpan={3}
                    className="py-3 px-3 uppercase tracking-wider text-[11px] bg-slate-200 text-center font-bold"
                  >
                    TOTALS & BALANCES
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                    {challan.openingQty.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-900 font-black">
                    {totals.targetInput.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">—</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-indigo-900 text-sm">
                    {totals.totalExpectedOutput.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-900 text-sm">
                    {totals.totalActualOutput.toLocaleString()}
                  </td>
                  {/* TOTAL NET DIFFERENCE (ACTUAL - EXPECTED) */}
                  <td className="py-3 px-3 text-right font-mono tabular-nums bg-sky-100/60 font-black text-sm">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-black ${
                        totals.netDifference > 0
                          ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                          : totals.netDifference < 0
                          ? 'text-rose-800 bg-rose-100 border border-rose-300'
                          : 'text-slate-800 bg-white border border-slate-300'
                      }`}
                    >
                      {totals.netDifference > 0
                        ? `+${totals.netDifference.toLocaleString()}`
                        : totals.netDifference.toLocaleString()}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums text-base ${
                      totals.currentBalance === 0
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-slate-900 bg-slate-200/90'
                    }`}
                  >
                    <div>{totals.currentBalance.toLocaleString()}</div>
                    {totals.currentBalance === 0 && challan.status !== 'Complete' && (
                      <button
                        onClick={handleMarkLotComplete}
                        className="mt-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer inline-flex items-center gap-1"
                        title="Mark order complete and save"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Complete & Save</span>
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center bg-amber-50/50">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-black border ${getStatusBadgeStyle(
                        challan.status
                      )}`}
                    >
                      {challan.status}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MODAL: Continue Production Past 30th/31st into Next Month */}
      {isContinueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Continue Production into Next Month
                </h3>
              </div>
              <button
                onClick={() => setIsContinueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                In garment manufacturing, orders often span across month boundaries (e.g. from{' '}
                <strong>
                  {parsedOrderDate.day}-{MONTH_NAMES[parsedOrderDate.month - 1]}
                </strong>{' '}
                past the 30th/31st into the next month).
              </p>
              <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                Current register ends on:{' '}
                <strong className="text-slate-900 font-mono">
                  {updatedRows[updatedRows.length - 1]?.dayLabel || 'N/A'}
                </strong>{' '}
                with remaining balance of{' '}
                <strong className="text-sky-700 font-mono">
                  {totals.currentBalance.toLocaleString()} pcs
                </strong>
                .
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Quick 1-Click Extensions:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Preset: 15th of next month (User explicit scenario!) */}
                <button
                  type="button"
                  onClick={() => handleContinueToNextMonth()}
                  className="p-3 border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <span className="block text-xs font-black text-indigo-900 group-hover:text-indigo-950">
                    🎯 Through 15th
                  </span>
                  <span className="text-[11px] text-indigo-700 mt-0.5 block">
                    Next month 1st to 15th
                  </span>
                </button>

                {/* Preset: Full Next Month */}
                <button
                  type="button"
                  onClick={handleContinueFullNextMonth}
                  className="p-3 border border-sky-200 bg-sky-50/60 hover:bg-sky-100 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <span className="block text-xs font-black text-sky-900 group-hover:text-sky-950">
                    📅 Full Next Month
                  </span>
                  <span className="text-[11px] text-sky-700 mt-0.5 block">
                    All 30/31 days of month
                  </span>
                </button>

                {/* Preset: Add 7 Days */}
                <button
                  type="button"
                  onClick={handleAdd7Days}
                  className="p-3 border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <span className="block text-xs font-black text-emerald-900 group-hover:text-emerald-950">
                    ⚡ Add 7 Days
                  </span>
                  <span className="text-[11px] text-emerald-700 mt-0.5 block">
                    Extend 1 week forward
                  </span>
                </button>
              </div>
            </div>

            {/* Custom Date Picker */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Or Pick Exact Target End Date:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customContinueDate}
                  onChange={(e) => setCustomContinueDate(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  disabled={!customContinueDate}
                  onClick={() => handleContinueToNextMonth(customContinueDate)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Extend Dates
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsContinueModalOpen(false)}
                className="px-4 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete DC Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Delete Delivery Challan</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete <strong>DC #{challan.dcNo}</strong> ({challan.party})?
              All date-wise production records will be deleted permanently.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteCurrentDC(challan.id);
                  setDeleteConfirmOpen(false);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Schedule Expected Quota Modal */}
      {isAutoScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>Auto-Schedule Expected Quota</span>
              </div>
              <button
                onClick={() => setIsAutoScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Automatically calculate and populate daily Expected Output quotas based on your daily stitching target.
                Sundays are automatically skipped as off-days, and any remaining balance is allocated to the final day.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Production Balance:</span>
                  <span className="font-bold text-slate-900">
                    {(totals.currentBalance || challan.openingQty).toLocaleString()} Pcs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Working Days:</span>
                  <span className="font-bold text-sky-700">
                    {modalTargetRate > 0
                      ? Math.ceil((totals.currentBalance || challan.openingQty) / modalTargetRate)
                      : 0}{' '}
                    Working Days
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 uppercase text-[11px] tracking-wide">
                  Daily Target Quota (Pcs / Day)
                </label>
                <input
                  type="number"
                  min={1}
                  value={modalTargetRate}
                  onChange={(e) => setModalTargetRate(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. 800"
                />
              </div>

              {/* Quick Rate Presets */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-500 text-[11px]">Presets:</span>
                {[500, 650, 800, 1000, 1200].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setModalTargetRate(rate)}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                      modalTargetRate === rate
                        ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  handleClearSchedule();
                  setIsAutoScheduleModalOpen(false);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
              >
                Clear Schedule
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAutoScheduleModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rows.length === 0 || modalTargetRate <= 0) return;
                    const sorted = [...rows].sort(
                      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
                    );
                    const firstRow = sorted[0];
                    const startingBal = totals.currentBalance > 0 ? totals.currentBalance : challan.openingQty;
                    const result = autoScheduleExpectedQuota(
                      rows,
                      firstRow.id,
                      modalTargetRate,
                      startingBal
                    );
                    setRows(result.updatedRowsList);
                    setAutoScheduleNotification({
                      days: result.scheduledDays,
                      rate: modalTargetRate,
                      remainder: result.remainder,
                      endDateLabel: result.endDayLabel,
                      startRowId: firstRow.id,
                      previousExpectedRows: sorted.map((r) => ({ id: r.id, val: r.expectedOutput ?? null })),
                    });
                    saveCompletePlanToSupabase(result.updatedRowsList);
                    setIsAutoScheduleModalOpen(false);
                  }}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                >
                  Apply Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print / Export Register & Sheet Modal */}
      <PrintRegisterModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        challan={challan}
        rows={updatedRows}
        totals={totals}
        month={month}
        year={year}
        currentUser={currentUser}
      />
    </div>
  );
}
