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

// Safe in-memory fallback store for sandboxed or cross-origin iframe environments
const memoryFallbackStore = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    // CRITICAL SECURITY: During SSR, never return client session data from server memory!
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      if (window.sessionStorage) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Storage restricted
    }
    try {
      if (window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Storage restricted / sandboxed iframe
    }
    return memoryFallbackStore.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Storage restricted / sandboxed iframe
    }
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch {
      // Storage restricted
    }
    memoryFallbackStore.set(key, value);
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') {
      memoryFallbackStore.delete(key);
      return;
    }
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage restricted
    }
    try {
      if (window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Storage restricted
    }
    memoryFallbackStore.delete(key);
  },
  clearPrefix: (prefix: string): void => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage) {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      }
    } catch {
      // Storage restricted
    }
    try {
      if (window.sessionStorage) {
        const toRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith(prefix)) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.sessionStorage.removeItem(k));
      }
    } catch {
      // Storage restricted
    }
    for (const k of Array.from(memoryFallbackStore.keys())) {
      if (k.startsWith(prefix)) {
        memoryFallbackStore.delete(k);
      }
    }
  },
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
    item: 'Denim Jacket',
    openingQty: 5000,
    orderDate: '2026-11-11',
    firstExpectedDate: '2026-11-12',
    dailyExpectedRate: 800,
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
    const isFirstEntry = isOrderStartMonth && day === parsed.day;

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

/**
 * Adds an integer number of calendar days to a YYYY-MM-DD date string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  if (!dateStr || days <= 0) return dateStr;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCDate(d.getUTCDate() + days);
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(d.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export interface CalendarDayInfo {
  year: number;
  month: number;
  day: number;
  dayOfWeek: string; // 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
  isSunday: boolean;
  isSaturday: boolean;
  isWorkingDay: boolean; // Monday through Saturday are active factory production days!
  dayIndex: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

/**
 * Universal timezone-safe calendar day parser.
 * Always resolves YYYY-MM-DD into the exact calendar day in UTC,
 * preventing any browser or server local timezone offset from shifting dates backwards or skipping Saturdays!
 */
export function getCalendarDayInfo(dateStr: string): CalendarDayInfo {
  if (!dateStr || typeof dateStr !== 'string') {
    return {
      year: 2026,
      month: 1,
      day: 1,
      dayOfWeek: 'Thu',
      isSunday: false,
      isSaturday: false,
      isWorkingDay: true,
      dayIndex: 4,
    };
  }

  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 1;
  const d = parts[2] || 1;

  // Date.UTC guarantees absolute zero-drift calendar calculation
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayIndex = utcDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    year: y,
    month: m,
    day: d,
    dayOfWeek: dayNames[dayIndex],
    isSunday: dayIndex === 0,
    isSaturday: dayIndex === 6,
    isWorkingDay: dayIndex !== 0, // Saturday IS a working day! Only Sunday is off-day!
    dayIndex,
  };
}

export interface ScheduleTimelineCalculation {
  openingQty: number;
  dailyRate: number;
  startDate: string;
  workingDaysNeeded: number;
  calendarDaysSpan: number;
  sundaysSkipped: number;
  projectedEndDate: string;
  projectedEndDisplay: string;
  fullDays: number;
  remainder: number;
  dailyDistribution: Array<{
    dateStr: string;
    dayLabel: string;
    expectedOutput: number | null;
    isSunday: boolean;
  }>;
}

/**
 * Pure deterministic calculation engine for production output timelines.
 * Calculates exact working days, Sunday skips, remainder allotment, and projected calendar completion date.
 * SATURDAY IS ALWAYS A WORKING PRODUCTION DAY. Only Sundays are off-days!
 */
export function calculateScheduleTimeline(
  openingQty: number,
  dailyRate: number,
  startDateStr: string
): ScheduleTimelineCalculation | null {
  if (!openingQty || openingQty <= 0 || !dailyRate || dailyRate <= 0 || !startDateStr) {
    return null;
  }

  const workingDaysNeeded = Math.ceil(openingQty / dailyRate);
  const fullDays = Math.floor(openingQty / dailyRate);
  const remainder = openingQty % dailyRate;

  let remaining = openingQty;
  let allocatedWorkingDays = 0;
  let currDate = startDateStr.trim().split('T')[0];
  let sundaysSkipped = 0;
  let calendarDaysSpan = 0;
  const dailyDistribution: Array<{
    dateStr: string;
    dayLabel: string;
    expectedOutput: number | null;
    isSunday: boolean;
  }> = [];

  let safety = 365;
  while (remaining > 0 && allocatedWorkingDays < workingDaysNeeded && safety > 0) {
    safety--;
    calendarDaysSpan++;
    const dayInfo = getCalendarDayInfo(currDate);

    if (dayInfo.isSunday) {
      sundaysSkipped++;
      dailyDistribution.push({
        dateStr: currDate,
        dayLabel: formatDayLabel(currDate),
        expectedOutput: null,
        isSunday: true,
      });
    } else {
      allocatedWorkingDays++;
      let quota = dailyRate;
      if (allocatedWorkingDays === workingDaysNeeded || remaining <= dailyRate) {
        quota = remaining;
        remaining = 0;
      } else {
        remaining -= dailyRate;
      }
      dailyDistribution.push({
        dateStr: currDate,
        dayLabel: formatDayLabel(currDate),
        expectedOutput: quota,
        isSunday: false,
      });
    }

    if (remaining > 0) {
      currDate = getNextDateString(currDate);
    }
  }

  const projectedEndDate = dailyDistribution[dailyDistribution.length - 1]?.dateStr || currDate;
  const endDayInfo = getCalendarDayInfo(projectedEndDate);
  const projectedEndDisplay = `${endDayInfo.dayOfWeek}, ${endDayInfo.day}-${MONTH_NAMES[endDayInfo.month - 1]}-${endDayInfo.year}`;

  return {
    openingQty,
    dailyRate,
    startDate: startDateStr,
    workingDaysNeeded,
    calendarDaysSpan,
    sundaysSkipped,
    projectedEndDate,
    projectedEndDisplay,
    fullDays,
    remainder,
    dailyDistribution,
  };
}

export function buildRowForDate(
  challan: Challan,
  dateStr: string,
  isFirstOfOrder: boolean = false
): PlanningRow {
  const cleanDate = dateStr.trim().split('T')[0];
  const dayInfo = getCalendarDayInfo(cleanDate);
  const y = dayInfo.year;
  const m = dayInfo.month;
  const d = dayInfo.day;
  const dayLabel = formatDayLabel(cleanDate);

  return {
    id: `row_${challan.id}_${y}_${m}_${d}`,
    challanId: challan.id,
    year: y,
    month: m,
    dayNumber: d,
    dateStr: cleanDate,
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
    sortOrder: d,
    status: 'Process',
  };
}

/**
 * Fills any calendar date gaps in an array of PlanningRows.
 * Guarantees that every consecutive calendar day from earliest to latest date is present!
 * (e.g. 29-Oct, 30-Oct, 31-Oct, 1-Nov, 2-Nov, 3-Nov... with NO missing days).
 */
export function fillDateGapsInRows(challan: Challan, currentRows: PlanningRow[]): PlanningRow[] {
  if (!currentRows || currentRows.length <= 1) return currentRows;

  const sorted = [...currentRows].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const dateMap = new Map<string, PlanningRow>();
  sorted.forEach((r) => {
    const d = (r.dateStr || '').trim().split('T')[0];
    if (d) dateMap.set(d, r);
  });

  const firstDate = sorted[0].dateStr.trim().split('T')[0];
  const lastDate = sorted[sorted.length - 1].dateStr.trim().split('T')[0];

  let curr = firstDate;
  const completeRows: PlanningRow[] = [];
  let safety = 365;

  while (curr <= lastDate && safety > 0) {
    safety--;
    const existing = dateMap.get(curr);
    if (existing) {
      completeRows.push(existing);
    } else {
      completeRows.push(buildRowForDate(challan, curr, false));
    }
    curr = getNextDateString(curr);
  }

  return completeRows;
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
    // Opening lot arrival day is locked: cut panels and fabric arrive today, output begins on Day 2
    const isOpeningDay = index === 0 || (row.qty !== null && row.qty !== undefined && Number(row.qty) > 0);

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

    // Expected output planned quota (locked to null on opening lot arrival day)
    const validExpected = isOpeningDay
      ? null
      : row.expectedOutput !== null &&
        row.expectedOutput !== undefined &&
        Number(row.expectedOutput) > 0
      ? Number(row.expectedOutput)
      : null;

    if (validExpected !== null && validExpected > 0) {
      totalExpected += validExpected;
    }

    // True calendar day gap from last active output across month boundaries
    let calculatedGap = 0;
    if (
      !isOpeningDay &&
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

    // Actual output achieved on floor (locked to null on opening lot arrival day)
    const validActual = isOpeningDay
      ? null
      : row.actualOutput !== null && row.actualOutput !== undefined
      ? Number(row.actualOutput)
      : null;

    if (validActual !== null) {
      totalActual += validActual;
      if (validActual > 0) {
        daysWithOutput++;
      }
      runningBalance = Math.max(0, runningBalance - validActual);
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
  if (typeof window === 'undefined') {
    return DEFAULT_CHALLANS;
  }
  try {
    const res = await fetch('/api/challans', { cache: 'no-store' });
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      const list: Challan[] = json.data.map((c: Challan) => ({
        ...c,
        status: normalizeStitchingStatus(c.status),
      }));
      safeStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(list));
      return list;
    }
  } catch (err) {
    console.warn('Could not fetch challans from server API:', err);
  }

  // Fallback to safeStorage
  const raw = safeStorage.getItem(STORAGE_KEYS.CHALLANS);
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
  safeStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(DEFAULT_CHALLANS));
  return DEFAULT_CHALLANS;
}

/**
 * Auto-schedules expected outputs starting strictly from firstExpectedDate.
 * Follows the formula: Math.ceil(Balance / Rate) days needed, skips Sundays (off-day),
 * and puts the remaining balance on the final day so total matches opening QTY.
 */
export function generateAutoScheduledRows(challan: Challan): PlanningRow[] {
  const parsedStart = parseOrderDate(challan.orderDate);
  const startYear = parsedStart.year;
  const startMonth = parsedStart.month;

  let rows = generateMonthDays(challan, startYear, startMonth);

  const balance = challan.openingQty || 5000;
  const targetRate =
    challan.dailyExpectedRate && challan.dailyExpectedRate > 0
      ? challan.dailyExpectedRate
      : 622;
  const expectedStartDate = (
    challan.firstExpectedDate ||
    challan.orderDate ||
    new Date().toISOString().split('T')[0]
  ).trim().split('T')[0];

  // Ensure rows extend from orderDate up to at least expectedStartDate
  let maxPrep = 120;
  while (maxPrep > 0) {
    maxPrep--;
    const sorted = [...rows].sort(
      (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
    );
    const last = sorted[sorted.length - 1];
    if (!last || new Date(last.dateStr).getTime() >= new Date(expectedStartDate).getTime()) {
      break;
    }
    const nextD = getNextDateString(last.dateStr);
    rows.push(buildRowForDate(challan, nextD, false));
  }

  const timeline = calculateScheduleTimeline(balance, targetRate, expectedStartDate);
  if (timeline) {
    timeline.dailyDistribution.forEach((item) => {
      let existing = rows.find((r) => r.dateStr === item.dateStr);
      if (!existing) {
        existing = buildRowForDate(challan, item.dateStr, false);
        rows.push(existing);
      }
      existing.expectedOutput = item.expectedOutput;
    });
  }

  // Deduplicate and sort chronologically
  const map = new Map<string, PlanningRow>();
  rows.forEach((r) => {
    const d = (r.dateStr || '').split('T')[0];
    if (d) map.set(d, { ...r, dateStr: d });
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
  );
}

/**
 * Calculates current balance, extra input, actual output, and completion stats for any challan.
 */
export function getLocalChallanBalance(challan: Challan): {
  totalInput: number;
  totalActual: number;
  remainingBalance: number;
  completionRate: number;
} {
  if (challan.status === 'Complete') {
    return {
      totalInput: challan.openingQty,
      totalActual: challan.openingQty,
      remainingBalance: 0,
      completionRate: 100,
    };
  }

  if (challan.remainingBalance !== undefined && challan.completionRate !== undefined) {
    return {
      totalInput: challan.openingQty,
      totalActual: challan.totalActualOutput || 0,
      remainingBalance: challan.remainingBalance,
      completionRate: challan.completionRate,
    };
  }

  // Fallback to checking cached safe storage rows
  const parsed = parseOrderDate(challan.orderDate);
  const key = `${STORAGE_KEYS.PLANNING_PREFIX}${challan.id}_${parsed.year}_${parsed.month}`;
  const raw = safeStorage.getItem(key);
  if (raw) {
    try {
      const rows: PlanningRow[] = JSON.parse(raw);
      if (Array.isArray(rows) && rows.length > 0) {
        const rec = recalculatePlanningRows(rows, challan.openingQty);
        return {
          totalInput: rec.totals.targetInput,
          totalActual: rec.totals.totalActualOutput,
          remainingBalance: rec.totals.currentBalance,
          completionRate: rec.totals.completionRate,
        };
      }
    } catch {
      // ignore
    }
  }

  return {
    totalInput: challan.openingQty,
    totalActual: 0,
    remainingBalance: challan.openingQty,
    completionRate: 0,
  };
}

export async function createChallan(
  challan: Challan
): Promise<{ success: boolean; challan: Challan; error?: string }> {
  let createdChallan: Challan = challan;
  try {
    const res = await fetch('/api/challans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challan),
    });
    const json = await res.json();
    if (json.success && json.data) {
      createdChallan = {
        ...json.data,
        status: normalizeStitchingStatus(json.data.status),
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error creating challan via server API:', msg);
  }

  // Update local challans cache
  const current = await getChallans();
  const updated = [
    createdChallan,
    ...current.filter((c) => c.id !== createdChallan.id && c.dcNo !== createdChallan.dcNo),
  ];
  safeStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(updated));
  broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId: createdChallan.id }).catch(() => {});

  // Generate and AWAIT initial auto-scheduled expected quota rows!
  if (
    createdChallan.firstExpectedDate &&
    createdChallan.dailyExpectedRate &&
    createdChallan.dailyExpectedRate > 0
  ) {
    try {
      const initialRows = generateAutoScheduledRows(createdChallan);
      const parsed = parseOrderDate(createdChallan.orderDate);
      const key = `${STORAGE_KEYS.PLANNING_PREFIX}${createdChallan.id}_${parsed.year}_${parsed.month}`;
      safeStorage.setItem(key, JSON.stringify(initialRows));
      const extKey = `${STORAGE_KEYS.EXTENDED_DATES_PREFIX}${createdChallan.id}`;
      safeStorage.setItem(extKey, JSON.stringify(initialRows.map((r) => r.dateStr)));
      await savePlanningSchedule(createdChallan.id, parsed.year, parsed.month, initialRows);
    } catch (e) {
      console.warn('Initial auto schedule save note (cached locally):', e);
    }
  }

  return { success: true, challan: createdChallan };
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
  safeStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(next));
  broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId: challan.id }).catch(() => {});
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
  safeStorage.setItem(STORAGE_KEYS.CHALLANS, JSON.stringify(next));
  broadcastLiveChange({ type: 'CHALLAN_UPDATE', challanId }).catch(() => {});
}

// 2. DAILY PLANNING REGISTER ROWS
export async function getPlanningSchedule(
  challan: Challan,
  year: number,
  month: number
): Promise<PlanningRow[]> {
  const defaultRows = generateMonthDays(challan, year, month);
  if (typeof window === 'undefined') {
    return defaultRows;
  }

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
      const extKey = `${STORAGE_KEYS.EXTENDED_DATES_PREFIX}${challan.id}`;
      const rawExt = safeStorage.getItem(extKey);
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

      // If no expected output has been recorded yet, and firstExpectedDate + dailyExpectedRate are set, blend auto-schedule
      const hasAnyExpectedOutput = uniqueMerged.some(
        (r) => r.expectedOutput !== null && r.expectedOutput !== undefined && Number(r.expectedOutput) > 0
      );
      if (!hasAnyExpectedOutput) {
        const autoRows = generateAutoScheduledRows(challan);
        const autoMap = new Map(autoRows.map((r) => [r.dateStr, r.expectedOutput]));
        for (const r of uniqueMerged) {
          if (autoMap.has(r.dateStr)) {
            r.expectedOutput = autoMap.get(r.dateStr) ?? null;
          }
        }
        for (const ar of autoRows) {
          if (!uniqueMerged.some((r) => r.dateStr === ar.dateStr)) {
            uniqueMerged.push(ar);
          }
        }
        uniqueMerged.sort(
          (a, b) => a.dateStr.localeCompare(b.dateStr)
        );
      }

      return fillDateGapsInRows(challan, uniqueMerged);
    }
  } catch (err) {
    console.warn(
      'Could not fetch planning from server API, checking local storage:',
      err
    );
  }

  // Fallback to local storage
  const key = `${STORAGE_KEYS.PLANNING_PREFIX}${challan.id}_${year}_${month}`;
  const raw = safeStorage.getItem(key);
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
          const sorted = cleaned.sort(
            (a, b) => a.dateStr.localeCompare(b.dateStr)
          );

          if (
            !sorted.some((r) => r.expectedOutput !== null && r.expectedOutput !== undefined && Number(r.expectedOutput) > 0) &&
            challan.firstExpectedDate &&
            challan.dailyExpectedRate &&
            challan.dailyExpectedRate > 0
          ) {
            const autoRows = generateAutoScheduledRows(challan);
            const autoMap = new Map(autoRows.map((r) => [r.dateStr, r.expectedOutput]));
            for (const r of sorted) {
              if (autoMap.has(r.dateStr)) {
                r.expectedOutput = autoMap.get(r.dateStr) ?? null;
              }
            }
          }

          return fillDateGapsInRows(challan, sorted);
        }
      } catch {
        // ignore
      }
    }

  if (challan.firstExpectedDate && challan.dailyExpectedRate && challan.dailyExpectedRate > 0) {
    return fillDateGapsInRows(challan, generateAutoScheduledRows(challan));
  }

  return fillDateGapsInRows(challan, defaultRows);
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
  const key = `${STORAGE_KEYS.PLANNING_PREFIX}${challanId}_${year}_${month}`;
  safeStorage.setItem(key, JSON.stringify(cleanRows));

  // Save all dates present in the rows to extended dates registry
  const extKey = `${STORAGE_KEYS.EXTENDED_DATES_PREFIX}${challanId}`;
  const allDates = cleanRows.map((r) => r.dateStr);
  safeStorage.setItem(extKey, JSON.stringify(allDates));

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
    broadcastLiveChange({ type: 'PLAN_UPDATE', challanId }).catch(() => {});
    return json;
  } catch (err) {
    console.error('Error saving planning rows to server API:', err);
    throw err;
  }
}

/**
 * Resets all planning entries for a challan:
 * Clears database records via DELETE API, purges localStorage cache,
 * and returns clean, pristine month rows with Day 1 locked and empty manual cells.
 */
export async function resetChallanPlanningEntries(
  challan: Challan,
  year: number,
  month: number
): Promise<PlanningRow[]> {
  try {
    await fetch(`/api/planning?challanId=${challan.id}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Error deleting planning entries from API:', err);
  }

  const prefix = `${STORAGE_KEYS.PLANNING_PREFIX}${challan.id}_`;
  safeStorage.clearPrefix(prefix);
  const extKey = `${STORAGE_KEYS.EXTENDED_DATES_PREFIX}${challan.id}`;
  safeStorage.removeItem(extKey);
  broadcastLiveChange({ type: 'PLAN_UPDATE', challanId: challan.id }).catch(() => {});

  return generateMonthDays(challan, year, month);
}

// 3. USER MANAGEMENT & AUTH (Backed by Supabase API)
export async function getRemoteUsers(): Promise<UserProfile[]> {
  if (typeof window === 'undefined') {
    return DEFAULT_USERS;
  }
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
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
  broadcastLiveChange({ type: 'USER_UPDATE', userId: data.user.id }).catch(() => {});
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
    broadcastLiveChange({ type: 'USER_UPDATE', userId }).catch(() => {});
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
  const users = getLocalUsers();
  const next = users.filter((u) => u.id !== userId);
  safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));

  // If deleting currently logged in user, clear session
  const cur = getCurrentUser();
  if (cur && cur.id === userId) {
    setCurrentUser(null);
  }
  broadcastLiveChange({ type: 'USER_UPDATE', userId }).catch(() => {});
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
  const raw = safeStorage.getItem(STORAGE_KEYS.USERS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

export function saveLocalUser(user: UserProfile): void {
  const users = getLocalUsers();
  const next = [
    user,
    ...users.filter((u) => u.id !== user.id && u.email.toLowerCase() !== user.email.toLowerCase()),
  ];
  safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
}

export function getCurrentUser(): UserProfile | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if explicit logout flag is active
  try {
    const isLoggedOut = safeStorage.getItem('eye_erp_logged_out');
    if (isLoggedOut === 'true') {
      return null;
    }
  } catch {}

  const raw = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && parsed.id) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function setCurrentUser(user: UserProfile | null): void {
  if (user) {
    safeStorage.removeItem('eye_erp_logged_out');
    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    // Explicit, irreversible logout
    safeStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    safeStorage.setItem('eye_erp_logged_out', 'true');
    // Clear directly across browser storages
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem(STORAGE_KEYS.CURRENT_USER);
        window.localStorage?.setItem('eye_erp_logged_out', 'true');
      } catch {}
      try {
        window.sessionStorage?.removeItem(STORAGE_KEYS.CURRENT_USER);
        window.sessionStorage?.setItem('eye_erp_logged_out', 'true');
      } catch {}
    }
  }
}

// 4. ACTIVE CONTEXT HELPERS
export function getActiveDCId(): string {
  return safeStorage.getItem(STORAGE_KEYS.ACTIVE_DC_ID) || 'dc-3696';
}

export function setActiveDCId(id: string): void {
  safeStorage.setItem(STORAGE_KEYS.ACTIVE_DC_ID, id);
}

export function getSavedYear(): number {
  const raw = safeStorage.getItem(STORAGE_KEYS.ACTIVE_YEAR);
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return getCurrentCalendarYear();
}

export function saveActiveYear(year: number): void {
  safeStorage.setItem(STORAGE_KEYS.ACTIVE_YEAR, String(year));
}

export function getSavedMonth(): number {
  const raw = safeStorage.getItem(STORAGE_KEYS.ACTIVE_MONTH);
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  }
  return getCurrentCalendarMonth();
}

export function saveActiveMonth(month: number): void {
  safeStorage.setItem(STORAGE_KEYS.ACTIVE_MONTH, String(month));
}

