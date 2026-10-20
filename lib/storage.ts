import { Challan, PlanningRow, PlanningTotals, StitchingStatus, UserProfile, UserRole } from '@/types';
import { broadcastLiveChange } from './realtime';

const STORAGE_KEYS = {
  CHALLANS: 'eye_erp_challans',
  PLANNING_PREFIX: 'eye_erp_planning_',
  EXTENDED_DATES_PREFIX: 'eye_erp_extended_dates_',
  USERS: 'eye_erp_users',
  CURRENT_USER: 'eye_erp_current_user',
  ACTIVE_DC_ID: 'eye_erp_active_dc_id',
  ACTIVE_YEAR: 'eye_erp_active_year',
  ACTIVE_MONTH: 'eye_erp_active_month',
};

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getCurrentCalendarMonth(): number {
  return new Date().getMonth() + 1; // 1-12
}

export function getCurrentCalendarYear(): number {
  return new Date().getFullYear();
}

export interface ParsedOrderDate {
  year: number;
  month: number;
  day: number;
  formatted: string; // "YYYY-MM-DD"
  display: string; // "11-Nov-2026"
}

/**
 * Robust date parser supporting YYYY-MM-DD, DD-MM-YYYY, DD-MM-YY (e.g. 11-11-26), and ISO formats.
 */
export function parseOrderDate(dateStr?: string): ParsedOrderDate {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return {
      year: y,
      month: m,
      day: d,
      formatted: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      display: `${d}-${MONTH_NAMES[m - 1]}-${y}`,
    };
  }

  const clean = dateStr.trim();

  // 1. Try YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    const validM = Math.min(12, Math.max(1, m));
    const validD = Math.min(31, Math.max(1, d));
    return {
      year: y,
      month: validM,
      day: validD,
      formatted: `${y}-${String(validM).padStart(2, '0')}-${String(validD).padStart(2, '0')}`,
      display: `${validD}-${MONTH_NAMES[validM - 1]}-${y}`,
    };
  }

  // 2. Try DD-MM-YYYY or DD-MM-YY (e.g. 11-11-26 or 11-11-2026)
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) {
      y = 2000 + y; // e.g. 26 -> 2026
    }
    const validM = Math.min(12, Math.max(1, m));
    const validD = Math.min(31, Math.max(1, d));
    return {
      year: y,
      month: validM,
      day: validD,
      formatted: `${y}-${String(validM).padStart(2, '0')}-${String(validD).padStart(2, '0')}`,
      display: `${validD}-${MONTH_NAMES[validM - 1]}-${y}`,
    };
  }

  // 3. Fallback date parse
  const parsedDate = new Date(clean);
  if (!isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = parsedDate.getMonth() + 1;
    const d = parsedDate.getDate();
    return {
      year: y,
      month: m,
      day: d,
      formatted: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      display: `${d}-${MONTH_NAMES[m - 1]}-${y}`,
    };
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return {
    year: y,
    month: m,
    day: d,
    formatted: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    display: `${d}-${MONTH_NAMES[m - 1]}-${y}`,
  };
}

export function normalizeStitchingStatus(status?: string): StitchingStatus {
  if (!status) return 'Process';
  const clean = status.trim().toUpperCase();
  if (clean === 'COMPLETE' || clean === 'COMPLETED' || clean === 'CLOSED') {
    return 'Complete';
  }
  if (clean === 'INLINE' || clean === 'IN-LINE' || clean === 'QC') {
    return 'Inline';
  }
  return 'Process';
}

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr-admin-primary',
    email: 'admin@denimcrafts.com',
    fullName: 'System Administrator',
    role: 'admin',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const DEFAULT_CHALLANS: Challan[] = [
  {
    id: 'dc-3696',
    dcNo: '3696',
    party: 'Line 1 - Front & Back Assembly',
    article: 'Denim Stretch 12.5oz Slim Fit',
    openingQty: 5000,
    orderDate: '2026-11-11',
    notes: 'Primary export lot - Karachi Unit',
    status: 'Process',
    createdBy: 'usr-admin-1',
    createdAt: '2026-11-11T08:00:00Z',
    updatedAt: '2026-11-11T08:00:00Z',
  },
];

/**
 * Generates calendar day rows for any month and year.
 * CRITICAL RULE: When viewing the order's start month, rows ONLY START from the order date day!
 * E.g. If order date is 11-11-2026, the ledger starts at day 11 (11-Nov), not day 1!
 */
export function generateMonthDays(
  challan: Challan,
  year: number,
  month: number
): PlanningRow[] {
  const rows: PlanningRow[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthAbbr = MONTH_NAMES[month - 1];

  const parsed = parseOrderDate(challan.orderDate);

  // If viewed year/month is strictly before the order date, no production rows exist
  if (year < parsed.year || (year === parsed.year && month < parsed.month)) {
    return [];
  }

  // If this is the month the order was placed, start directly on the order date!
  const isOrderStartMonth = year === parsed.year && month === parsed.month;
  const startDay = isOrderStartMonth ? Math.min(parsed.day, daysInMonth) : 1;

  for (let day = startDay; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLabel = `${day}-${monthAbbr}`;
    const isFirstEntry = day === startDay;

    rows.push({
      id: `row_${challan.id}_${year}_${month}_${day}`,
      challanId: challan.id,
      year,
      month,
      dayNumber: day,
      dateStr,
      dayLabel,
      dcNo: isFirstEntry ? challan.dcNo : undefined,
      qty: isFirstEntry ? challan.openingQty : null,
      inputQty: null,
      buyerNotes: null,
      daysGap: 0,
      expectedOutput: null,
      actualOutput: null,
      balance: challan.openingQty,
      isZeroBalance: false,
      sortOrder: day,
      status: 'Process',
    });
  }

  return rows;
}

/**
 * Computes the next consecutive date (YYYY-MM-DD) from a given YYYY-MM-DD string.
 * Handles month and year transitions (e.g. 2026-11-30 -> 2026-12-01).
 */
export function getNextDateString(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const curDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  curDate.setUTCDate(curDate.getUTCDate() + 1);
  const ny = curDate.getUTCFullYear();
  const nm = String(curDate.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(curDate.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function formatDayLabel(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  return `${d}-${MONTH_NAMES[m - 1]}`;
}

export function buildRowForDate(
  challan: Challan,
  dateStr: string,
  isFirstOfOrder: boolean = false
): PlanningRow {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const dayLabel = formatDayLabel(dateStr);

  return {
    id: `row_${challan.id}_${y}_${m}_${d}`,
    challanId: challan.id,
    year: y,
    month: m,
    dayNumber: d,
    dateStr,
    dayLabel,
    dcNo: isFirstOfOrder ? challan.dcNo : undefined,
    qty: isFirstOfOrder ? challan.openingQty : null,
    inputQty: null,
    buyerNotes: null,
    daysGap: 0,
    expectedOutput: null,
    actualOutput: null,
    balance: challan.openingQty,
    isZeroBalance: false,
    sortOrder: new Date(dateStr).getTime(),
    status: 'Process',
  };
}

/**
 * Appends the next consecutive calendar day to the current rows list.
 * E.g., if last row is 2026-11-30, next is 2026-12-01!
 */
export function addNextDayToRows(
  challan: Challan,
  currentRows: PlanningRow[]
): PlanningRow[] {
  if (currentRows.length === 0) {
    const parsed = parseOrderDate(challan.orderDate);
    return [buildRowForDate(challan, parsed.formatted, true)];
  }

  // Find latest date in currentRows
  const sorted = [...currentRows].sort(
    (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
  );
  const lastRow = sorted[sorted.length - 1];
  const nextDateStr = getNextDateString(lastRow.dateStr);

  if (currentRows.some((r) => r.dateStr === nextDateStr)) {
    return currentRows;
  }

  const newRow = buildRowForDate(challan, nextDateStr, false);
  return [...currentRows, newRow];
}

/**
 * Appends consecutive dates up to targetEndDateStr (e.g. "2026-12-15").
 * Allows continuing production seamlessly past 30th/31st into the next month!
 */
export function extendRowsThroughDate(
  challan: Challan,
  currentRows: PlanningRow[],
  targetEndDateStr: string
): PlanningRow[] {
  let result = [...currentRows];
  const targetTime = new Date(targetEndDateStr).getTime();

  let maxIterations = 90; // Up to 3 months forward
  while (maxIterations > 0) {
    maxIterations--;
    const sorted = [...result].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );
    const lastRow = sorted[sorted.length - 1];
    if (!lastRow) break;

    const lastTime = new Date(lastRow.dateStr).getTime();
    if (lastTime >= targetTime) {
      break;
    }

    const nextDateStr = getNextDateString(lastRow.dateStr);
    if (!result.some((r) => r.dateStr === nextDateStr)) {
      result.push(buildRowForDate(challan, nextDateStr, false));
    } else {
      break;
    }
  }

  return result;
}

/**
 * Pure Manufacturing Planning Running Balance & Totals Formula Engine:
 * Balance_i = Balance_{i-1} + ExtraInput_i - ActualOutput_i
 * Expected vs Actual Difference: netDifference = Total Actual - Total Expected
 *
 * CRITICAL LOGIC:
 * - Rows are sorted strictly chronologically by calendar date timestamp (new Date(r.dateStr).getTime()).
 * - This seamlessly supports orders continuing past month boundaries (e.g. 20-Nov to 15-Dec)!
 * - Days gap is calculated based on exact calendar days between consecutive output dates.
 */
export function recalculatePlanningRows(
  rows: PlanningRow[],
  openingQty: number
): {
  updatedRows: PlanningRow[];
  totals: PlanningTotals;
} {
  let runningBalance = openingQty || 0;
  let totalInput = openingQty || 0;
  let totalExpected = 0;
  let totalActual = 0;
  let daysWithOutput = 0;
  let lastActiveDateStr: string | null = null;

  // Strict chronological sort by date string timestamp!
  const sorted = [...rows].sort(
    (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
  );

  const updatedRows = sorted.map((row, index) => {
    // First active entry of order seeds starting balance
    if (index === 0) {
      const firstInput =
        row.inputQty !== null &&
        row.inputQty !== undefined &&
        Number(row.inputQty) > 0
          ? Number(row.inputQty)
          : openingQty;
      runningBalance = firstInput;
      totalInput = firstInput;
    } else if (
      row.inputQty !== null &&
      row.inputQty !== undefined &&
      Number(row.inputQty) > 0
    ) {
      const extra = Number(row.inputQty);
      totalInput += extra;
      runningBalance += extra;
    }

    // Expected output planned quota
    if (
      row.expectedOutput !== null &&
      row.expectedOutput !== undefined &&
      Number(row.expectedOutput) > 0
    ) {
      totalExpected += Number(row.expectedOutput);
    }

    // True calendar day gap from last active output across month boundaries
    let calculatedGap = 0;
    if (
      row.actualOutput !== null &&
      row.actualOutput !== undefined &&
      Number(row.actualOutput) > 0
    ) {
      if (lastActiveDateStr) {
        const prevTime = new Date(lastActiveDateStr).getTime();
        const currTime = new Date(row.dateStr).getTime();
        const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
        calculatedGap = Math.max(0, diffDays - 1);
      }
      lastActiveDateStr = row.dateStr;
    }

    // Actual output achieved on floor
    if (row.actualOutput !== null && row.actualOutput !== undefined) {
      const actual = Number(row.actualOutput);
      totalActual += actual;
      if (actual > 0) {
        daysWithOutput++;
      }
      runningBalance = Math.max(0, runningBalance - actual);
    }

    const isZero = runningBalance === 0 && (totalActual > 0 || totalInput > 0);

    // Default status derivation if not explicitly customized
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

    return {
      ...row,
      daysGap: row.daysGap && row.daysGap > 0 ? row.daysGap : calculatedGap,
      balance: runningBalance,
      isZeroBalance: isZero,
      status: rowStatus,
    };
  });

  const variance = totalExpected - totalActual;
  const netDifference = totalActual - totalExpected; // Direct difference between Actual & Expected!
  const completionRate =
    totalInput > 0 ? Math.min(100, Math.round((totalActual / totalInput) * 100)) : 0;
  const averageDailyOutput =
    daysWithOutput > 0 ? Math.round(totalActual / daysWithOutput) : 0;

  return {
    updatedRows,
    totals: {
      targetInput: totalInput,
      totalExtraInput: Math.max(0, totalInput - openingQty),
      totalExpectedOutput: totalExpected,
      totalActualOutput: totalActual,
      currentBalance: runningBalance,
      variance,
      netDifference,
      averageDailyOutput,
      completionRate,
    },
  };
}

// ==========================================
// SERVER-SIDE API CLIENT (BYPASSING RLS)
// ==========================================

// 1. CHALLANS CRUD
export async function getChallans(): Promise<Challan[]> {
  try {
    const res = await fetch('/api/challans', { cache: 'no-store' });
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      const list: Challan[] = json.data.map((c: Challan) => ({
        ...c,
        status: normalizeStitchingStatus(c.status),
      }));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(list));
      }
      return list;
    }
  } catch (err) {
    console.warn('Could not fetch challans from server API:', err);
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.CHALLANS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: Challan) => ({
            ...c,
            status: normalizeStitchingStatus(c.status),
          }));
        }
      } catch {
        // ignore
      }
    }
    localStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(DEFAULT_CHALLANS));
  }
  return DEFAULT_CHALLANS;
}

export async function createChallan(
  challan: Challan
): Promise<{ success: boolean; challan: Challan; error?: string }> {
  try {
    const res = await fetch('/api/challans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challan),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const created: Challan = {
        ...json.data,
        status: normalizeStitchingStatus(json.data.status),
      };
      const current = await getChallans();
      const updated = [
        created,
        ...current.filter((c) => c.id !== created.id && c.dcNo !== created.dcNo),
      ];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(updated));
        broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId: created.id }).catch(() => {});
      }
      return { success: true, challan: created };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error creating challan via server API:', msg);
  }

  // Local fallback
  const current = await getChallans();
  const next = [
    challan,
    ...current.filter((c) => c.id !== challan.id && c.dcNo !== challan.dcNo),
  ];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(next));
    broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId: challan.id }).catch(() => {});
  }
  return { success: true, challan };
}

export async function updateChallan(challan: Challan): Promise<void> {
  try {
    await fetch(`/api/challans/${challan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challan),
    });
  } catch (err) {
    console.error('Error updating challan via server API:', err);
  }

  // Update local cache
  const current = await getChallans();
  const next = current.map((c) => (c.id === challan.id ? challan : c));
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(next));
    broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId: challan.id }).catch(() => {});
  }
}

export async function deleteChallan(challanId: string): Promise<void> {
  try {
    await fetch(`/api/challans/${challanId}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Error deleting challan via server API:', err);
  }

  // Update local cache
  const current = await getChallans();
  const next = current.filter((c) => c.id !== challanId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(next));
    broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId }).catch(() => {});
  }
}

// 2. DAILY PLANNING REGISTER ROWS
export async function getPlanningSchedule(
  challan: Challan,
  year: number,
  month: number
): Promise<PlanningRow[]> {
  const defaultRows = generateMonthDays(challan, year, month);

  try {
    const res = await fetch(
      `/api/planning?challanId=${challan.id}&year=${year}&month=${month}`,
      { cache: 'no-store' }
    );
    const json = await res.json();

    if (json.success && json.data) {
      const entriesMap = json.data;
      const mergedRows = defaultRows.map((r) => {
        const entry = entriesMap[r.dateStr];
        if (!entry) return r;

        let inputVal = entry.inputQty !== undefined ? entry.inputQty : r.inputQty;
        // Purge legacy auto-seeded 6300 if not manually put
        if (inputVal === 6300 && !entry.isManualInput) {
          inputVal = null;
        }

        return {
          ...r,
          inputQty: inputVal,
          isManualInput: entry.isManualInput,
          actualOutput:
            entry.actualOutput !== undefined ? entry.actualOutput : r.actualOutput,
          expectedOutput:
            entry.expectedOutput !== undefined ? entry.expectedOutput : r.expectedOutput,
          buyerNotes: entry.notes || r.buyerNotes,
          status: entry.status || r.status || 'Process',
        };
      });

      // Also append any entries that exist for this challan across continued dates/months
      Object.keys(entriesMap).forEach((dStr) => {
        if (!mergedRows.some((r) => r.dateStr === dStr)) {
          const entry = entriesMap[dStr];
          let inputVal = entry.inputQty !== undefined ? entry.inputQty : null;
          if (inputVal === 6300 && !entry.isManualInput) {
            inputVal = null;
          }
          mergedRows.push({
            ...buildRowForDate(challan, dStr, false),
            inputQty: inputVal,
            isManualInput: entry.isManualInput,
            actualOutput: entry.actualOutput !== undefined ? entry.actualOutput : null,
            expectedOutput:
              entry.expectedOutput !== undefined ? entry.expectedOutput : null,
            buyerNotes: entry.notes || null,
            status: entry.status || 'Process',
          });
        }
      });

      // Also check if user has extended dates saved locally
      if (typeof window !== 'undefined') {
        const extKey = `${STORAGE_KEYS.EXTENDED_DATES_PREFIX}${challan.id}`;
        const rawExt = localStorage.getItem(extKey);
        if (rawExt) {
          try {
            const extDates: string[] = JSON.parse(rawExt);
            extDates.forEach((dStr) => {
              if (!mergedRows.some((r) => r.dateStr === dStr)) {
                mergedRows.push(buildRowForDate(challan, dStr, false));
              }
            });
          } catch {
            // ignore
          }
        }
      }

      // Deduplicate by normalized dateStr
      const seenDates = new Set<string>();
      const uniqueMerged: PlanningRow[] = [];
      for (const r of mergedRows) {
        const normDate = (r.dateStr || '').trim().split('T')[0];
        if (!normDate || seenDates.has(normDate)) continue;
        seenDates.add(normDate);
        uniqueMerged.push({ ...r, dateStr: normDate });
      }

      // Sort chronologically
      uniqueMerged.sort(
        (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
      );
      return uniqueMerged;
    }
  } catch (err) {
    console.warn(
      'Could not fetch planning from server API, checking local storage:',
      err
    );
  }

  // Fallback to local storage
  if (typeof window !== 'undefined') {
    const key = `${STORAGE_KEYS.PLANNING_PREFIX}${challan.id}_${year}_${month}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsedRows: PlanningRow[] = JSON.parse(raw);
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          const seen = new Set<string>();
          const cleaned: PlanningRow[] = [];
          for (const r of parsedRows) {
            const normDate = (r.dateStr || '').trim().split('T')[0];
            if (!normDate || seen.has(normDate)) continue;
            seen.add(normDate);
            let inputVal = r.inputQty;
            if (inputVal === 6300 && !r.isManualInput) {
              inputVal = null;
            }
            cleaned.push({ ...r, dateStr: normDate, inputQty: inputVal });
          }
          return cleaned.sort(
            (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
          );
        }
      } catch {
        // ignore
      }
    }
  }

  return defaultRows;
}

export async function savePlanningSchedule(
  challanId: string,
  year: number,
  month: number,
  rows: PlanningRow[]
): Promise<{ success: boolean; count?: number; timestamp?: string }> {
  // Deduplicate and normalize rows by dateStr before saving
  const dateMap = new Map<string, PlanningRow>();
  for (const r of rows) {
    const normDate = (r.dateStr || '').trim().split('T')[0];
    if (!normDate) continue;
    dateMap.set(normDate, { ...r, dateStr: normDate });
  }
  const cleanRows = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
  );

  // 1. Save local
  if (typeof window !== 'undefined') {
    const key = `${STORAGE_KEYS.PLANNING_PREFIX}${challanId}_${year}_${month}`;
    localStorage.setItem(key, JSON.stringify(cleanRows));

    // Save all dates present in the rows to extended dates registry
    const extKey = `${STORAGE_KEYS.EXTENDED_DATES_PREFIX}${challanId}`;
    const allDates = cleanRows.map((r) => r.dateStr);
    localStorage.setItem(extKey, JSON.stringify(allDates));
  }

  // 2. Save server via API route (writes directly to Supabase entries table)
  try {
    const currentUser = getCurrentUser();
    const res = await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challanId,
        rows: cleanRows,
        userId: currentUser?.id,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      console.error('Supabase save error:', json.error);
      throw new Error(json.error || 'Failed to save to Supabase');
    }
    // Broadcast live update across all active managers, admins, and users immediately
    if (typeof window !== 'undefined') {
      broadcastLiveChange({ type: 'PLAN_UPDATE', challanId }).catch(() => {});
    }
    return json;
  } catch (err) {
    console.error('Error saving planning rows to server API:', err);
    throw err;
  }
}

// 3. USER MANAGEMENT & AUTH (Backed by Supabase API)
export async function getRemoteUsers(): Promise<UserProfile[]> {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
        }
        return data.users;
      }
    }
  } catch (err) {
    console.error('Error fetching users from server API:', err);
  }
  return getLocalUsers();
}

export async function createRemoteUser(payload: {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserProfile> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create user account');
  }

  // Update local cache
  saveLocalUser(data.user);
  if (typeof window !== 'undefined') {
    broadcastLiveChange({ type: 'USER_UPDATE', userId: data.user.id }).catch(() => {});
  }
  return data.user;
}

export async function updateRemoteUserStatus(
  userId: string,
  isActive: boolean
): Promise<void> {
  try {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isActive }),
    });
    if (typeof window !== 'undefined') {
      broadcastLiveChange({ type: 'USER_UPDATE', userId }).catch(() => {});
    }
  } catch (err) {
    console.error('Error updating user status on server:', err);
  }
}

export async function deleteRemoteUser(userId: string): Promise<void> {
  const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete user account');
  }

  // Update local cache
  if (typeof window !== 'undefined') {
    const users = getLocalUsers();
    const next = users.filter((u) => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));

    // If deleting currently logged in user, clear session
    const cur = getCurrentUser();
    if (cur && cur.id === userId) {
      setCurrentUser(null);
    }
    broadcastLiveChange({ type: 'USER_UPDATE', userId }).catch(() => {});
  }
}

export async function resetRemoteUserPassword(
  userId: string,
  newPass: string
): Promise<void> {
  const res = await fetch('/api/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password: newPass }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to reset user password');
  }
}

export async function authenticateUser(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (res.ok && data.success && data.user) {
      setCurrentUser(data.user);
      return { success: true, user: data.user };
    }
    return {
      success: false,
      error:
        data.error ||
        'Invalid credentials. Public self-registration is disabled. Only administrator-created accounts can sign in.',
    };
  } catch (err: any) {
    console.error('Login error:', err);
    if (err?.name === 'AbortError') {
      return {
        success: false,
        error: 'Authentication request timed out. Please check your network and try again.',
      };
    }
    return {
      success: false,
      error: 'Could not connect to authentication server. Please check your connection.',
    };
  }
}

/**
 * Validates the currently cached session against Supabase.
 * If user was deleted or deactivated by admin, immediately clears session and returns null.
 */
export async function verifyCurrentUserSession(): Promise<UserProfile | null> {
  const current = getCurrentUser();
  if (!current) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `/api/auth/verify?id=${encodeURIComponent(current.id)}&email=${encodeURIComponent(current.email)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.valid && data.user) {
        setCurrentUser(data.user);
        return data.user;
      }
    }
    // Session is invalid (e.g. user was deleted from database)
    setCurrentUser(null);
    return null;
  } catch (err) {
    console.warn('Could not verify session with server:', err);
    return current;
  }
}

export function getLocalUsers(): UserProfile[] {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy personal credentials if cached in browser
          const cleaned = parsed.filter(
            (u) =>
              u.email !== 'tzkusman786@gmail.com' &&
              u.email !== 'usman@gmail.com'
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cleaned));
          }
          return cleaned.length > 0 ? cleaned : DEFAULT_USERS;
        }
      } catch {
        // ignore
      }
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
  }
  return DEFAULT_USERS;
}

export function saveLocalUser(user: UserProfile): void {
  const users = getLocalUsers();
  const next = [
    user,
    ...users.filter((u) => u.id !== user.id && u.email.toLowerCase() !== user.email.toLowerCase()),
  ];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
  }
}

export function getCurrentUser(): UserProfile | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Clear any stored legacy personal email
        if (
          parsed &&
          (parsed.email === 'tzkusman786@gmail.com' || parsed.email === 'usman@gmail.com')
        ) {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          return null;
        }
        return parsed;
      } catch {
        // ignore
      }
    }
    return null;
  }
  return null;
}

export function setCurrentUser(user: UserProfile | null): void {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }
}

// 4. ACTIVE CONTEXT HELPERS
export function getActiveDCId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DC_ID) || 'dc-3696';
  }
  return 'dc-3696';
}

export function setActiveDCId(id: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DC_ID, id);
  }
}

export function getSavedYear(): number {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_YEAR);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return getCurrentCalendarYear();
}

export function saveActiveYear(year: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_YEAR, String(year));
  }
}

export function getSavedMonth(): number {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_MONTH);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
    }
  }
  return getCurrentCalendarMonth();
}

export function saveActiveMonth(month: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, String(month));
  }
}
