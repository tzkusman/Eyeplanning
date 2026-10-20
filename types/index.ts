export type UserRole = 'admin' | 'manager' | 'operator';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  passwordHash?: string;
  createdAt: string;
}

export type StitchingStatus = 'Process' | 'Inline' | 'Complete';

export interface Challan {
  id: string;
  dcNo: string;
  party: string;
  article: string;
  openingQty: number;
  orderDate: string; // YYYY-MM-DD or DD-MM-YYYY or DD-MM-YY
  notes?: string;
  status: StitchingStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyTarget {
  id: string;
  challanId: string;
  year: number;
  month: number;
  targetInput: number;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
}

export interface PlanningRow {
  id: string;
  challanId: string;
  year: number; // e.g. 2026
  month: number; // 1 to 12
  dayNumber: number; // 1 to 31
  dateStr: string; // e.g. "2026-11-11"
  dayLabel: string; // e.g. "11-Nov"
  dcNo?: string;
  qty?: number | null;
  inputQty?: number | null;
  isManualInput?: boolean;
  extraInput?: number | null;
  buyerNotes?: string | null;
  daysGap?: number | null;
  expectedOutput?: number | null;
  actualOutput?: number | null;
  balance: number;
  isZeroBalance?: boolean;
  sortOrder: number;
  status?: StitchingStatus;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: 'challan' | 'planning_row' | 'user';
  entityId: string;
  details: string;
  createdAt: string;
}

export interface PlanningTotals {
  targetInput: number;
  totalExtraInput: number;
  totalExpectedOutput: number;
  totalActualOutput: number;
  currentBalance: number;
  variance: number; // expected - actual
  netDifference: number; // actual - expected (Difference between Actual and Expected)
  averageDailyOutput: number;
  completionRate: number;
}
