'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Challan, PlanningRow, StitchingStatus, UserProfile } from '@/types';
import {
  getChallans,
  createChallan,
  updateChallan,
  deleteChallan,
  getPlanningSchedule,
  savePlanningSchedule,
  getCurrentUser,
  setCurrentUser,
  verifyCurrentUserSession,
  getLocalUsers,
  getRemoteUsers,
  createRemoteUser,
  updateRemoteUserStatus,
  deleteRemoteUser,
  resetRemoteUserPassword,
  saveLocalUser,
  getActiveDCId,
  setActiveDCId,
  getSavedYear,
  saveActiveYear,
  getSavedMonth,
  saveActiveMonth,
  parseOrderDate,
} from '@/lib/storage';
import { initRealtimeSubscription } from '@/lib/realtime';
import { UserRole } from '@/types';
import { Header } from '@/components/Header';
import { DateRegisterLedger } from '@/components/DateRegisterLedger';
import { DCHub } from '@/components/DCHub';
import { AdminUserManagement } from '@/components/AdminUserManagement';
import { NewDCModal } from '@/components/NewDCModal';
import { LoginModal } from '@/components/LoginModal';
import { LoginPage } from '@/components/LoginPage';
import { EyeLogo } from '@/components/EyeLogo';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  // Always default to 'challans' (All DCs Hub) on initial load
  const [activeView, setActiveView] = useState<'register' | 'challans' | 'admin'>('challans');
  const [challans, setChallans] = useState<Challan[]>([]);
  const [activeDCId, setActiveDCIdState] = useState<string>('dc-3696');

  // Dynamic calendar month and year
  const [year, setYear] = useState<number>(() => getSavedYear());
  const [month, setMonth] = useState<number>(() => getSavedMonth());

  const [planningRows, setPlanningRows] = useState<PlanningRow[]>([]);
  const [currentUser, setCurrentUserState] = useState<UserProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>(() => getLocalUsers());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isNewDCModalOpen, setIsNewDCModalOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState<Challan | null>(null);

  // Live real-time sync state
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string | null>(null);

  // Synchronized refs for real-time background callbacks
  const activeDCIdRef = useRef(activeDCId);
  const yearRef = useRef(year);
  const monthRef = useRef(month);
  const challansRef = useRef(challans);

  useEffect(() => {
    activeDCIdRef.current = activeDCId;
  }, [activeDCId]);

  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  useEffect(() => {
    monthRef.current = month;
  }, [month]);

  useEffect(() => {
    challansRef.current = challans;
  }, [challans]);

  // Load planning rows for active DC, year, and month
  const loadActiveData = useCallback(async (dcList: Challan[], dcId: string, y: number, m: number) => {
    const active = dcList.find((c) => c.id === dcId) || dcList[0];
    if (!active) return;

    const rows = await getPlanningSchedule(active, y, m);
    setPlanningRows(rows);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastLiveSyncTime(nowStr);
  }, []);

  // Multi-client real-time synchronization listener
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = initRealtimeSubscription({
      onPlanUpdate: async (updatedChallanId) => {
        // Refresh active plan if this DC was updated or on general ping
        if (!updatedChallanId || updatedChallanId === activeDCIdRef.current) {
          const list = challansRef.current;
          const active = list.find((c) => c.id === activeDCIdRef.current) || list[0];
          if (active) {
            const rows = await getPlanningSchedule(active, yearRef.current, monthRef.current);
            setPlanningRows(rows);
            const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastLiveSyncTime(nowStr);
          }
        }
      },
      onChallanUpdate: async () => {
        const list = await getChallans();
        setChallans(list);
        const active = list.find((c) => c.id === activeDCIdRef.current) || list[0];
        if (active) {
          const rows = await getPlanningSchedule(active, yearRef.current, monthRef.current);
          setPlanningRows(rows);
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastLiveSyncTime(nowStr);
        }
      },
      onUserUpdate: async () => {
        const remoteUsers = await getRemoteUsers();
        setUsers(remoteUsers);
      },
      onConnectionChange: (connected) => {
        setIsLiveConnected(connected);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Force manual sync button handler
  const handleManualSync = async () => {
    try {
      const list = await getChallans();
      setChallans(list);
      const active = list.find((c) => c.id === activeDCIdRef.current) || list[0];
      if (active) {
        const rows = await getPlanningSchedule(active, yearRef.current, monthRef.current);
        setPlanningRows(rows);
      }
      const remoteUsers = await getRemoteUsers();
      setUsers(remoteUsers);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastLiveSyncTime(nowStr);
    } catch (e) {
      console.warn('Manual sync error:', e);
    }
  };

  // Initial load: Verify session and fetch initial data if authenticated
  useEffect(() => {
    let isMounted = true;

    async function initSessionAndData() {
      // 1. Immediately read cached user from localStorage (0ms delay)
      const cachedUser = getCurrentUser();
      if (cachedUser) {
        setCurrentUserState(cachedUser);
        setIsCheckingAuth(false);
      } else {
        setIsCheckingAuth(false);
      }

      try {
        // 2. Verify session in background
        const verifiedUser = await verifyCurrentUserSession();
        if (!isMounted) return;

        if (!verifiedUser && cachedUser) {
          // Session was revoked on server
          setCurrentUserState(null);
          return;
        }

        if (verifiedUser) {
          setCurrentUserState(verifiedUser);
        }

        // Fetch real challans (via server API -> Supabase)
        const list = await getChallans();
        if (!isMounted) return;
        setChallans(list);

        const savedDC = getActiveDCId();
        const targetDC = list.some((c) => c.id === savedDC) ? savedDC : (list[0]?.id || 'dc-3696');
        setActiveDCIdState(targetDC);

        const active = list.find((c) => c.id === targetDC);
        if (active) {
          const parsed = parseOrderDate(active.orderDate);
          setYear(parsed.year);
          setMonth(parsed.month);
          await loadActiveData(list, targetDC, parsed.year, parsed.month);
        } else {
          const y = getSavedYear();
          const m = getSavedMonth();
          await loadActiveData(list, targetDC, y, m);
        }

        // Fetch live authorized users from Supabase
        const remoteList = await getRemoteUsers();
        if (isMounted && remoteList && remoteList.length > 0) {
          setUsers(remoteList);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) setIsCheckingAuth(false);
      }
    }

    initSessionAndData();

    return () => {
      isMounted = false;
    };
  }, [loadActiveData]);

  // Switch Active DC -> Automatically jump to the DC's order date month & year!
  const handleSelectDC = async (dcId: string, customList?: Challan[]) => {
    setActiveDCIdState(dcId);
    setActiveDCId(dcId);

    const list = customList && customList.length > 0 ? customList : challans;
    const active = list.find((c) => c.id === dcId) || list[0];
    let targetYear = year;
    let targetMonth = month;

    if (active) {
      const parsed = parseOrderDate(active.orderDate);
      targetYear = parsed.year;
      targetMonth = parsed.month;
      setYear(targetYear);
      setMonth(targetMonth);
      saveActiveYear(targetYear);
      saveActiveMonth(targetMonth);
    }

    if (active) {
      await loadActiveData(list, active.id, targetYear, targetMonth);
    }
    setActiveView('register');
  };

  // Year Change
  const handleYearChange = async (newYear: number) => {
    setYear(newYear);
    saveActiveYear(newYear);
    await loadActiveData(challans, activeDCId, newYear, month);
  };

  // Month Change
  const handleMonthChange = async (newMonth: number) => {
    setMonth(newMonth);
    saveActiveMonth(newMonth);
    await loadActiveData(challans, activeDCId, year, newMonth);
  };

  // Save Rows to Server (Persist directly to Supabase entries table)
  const handleSaveRowsToServer = async (rows: PlanningRow[]) => {
    setPlanningRows(rows);
    return await savePlanningSchedule(activeDCId, year, month, rows);
  };

  // Save or Update DC (Real Supabase Insert/Update)
  const handleSaveDC = async (savedChallan: Challan) => {
    if (editingChallan) {
      const parsed = parseOrderDate(savedChallan.orderDate);
      setYear(parsed.year);
      setMonth(parsed.month);
      saveActiveYear(parsed.year);
      saveActiveMonth(parsed.month);

      await updateChallan(savedChallan);
      const updatedList = await getChallans();
      setChallans(updatedList);
      setIsNewDCModalOpen(false);
      setEditingChallan(null);
      await handleSelectDC(savedChallan.id, updatedList);
    } else {
      const result = await createChallan(savedChallan);
      const updatedList = await getChallans();
      setChallans(updatedList);
      setIsNewDCModalOpen(false);
      setEditingChallan(null);

      // Auto-jump to the newly created DC's order date month & year
      const parsed = parseOrderDate(result.challan.orderDate);
      setYear(parsed.year);
      setMonth(parsed.month);
      saveActiveYear(parsed.year);
      saveActiveMonth(parsed.month);

      await handleSelectDC(result.challan.id, updatedList);
    }
  };

  // Update DC (Order Date, Status, Details)
  const handleUpdateDC = async (updatedChallan: Challan) => {
    const existing = challans.find((c) => c.id === updatedChallan.id);
    const orderDateChanged = existing && existing.orderDate !== updatedChallan.orderDate;

    // 1. Persist DC update to Supabase
    await updateChallan(updatedChallan);
    const updatedList = await getChallans();
    setChallans(updatedList);

    // 2. CRITICAL FIX: Only reload planning rows if the order date itself changed!
    // Changing status (e.g. to 'Complete' or 'Inline') must NEVER wipe or reset the active plan rows!
    if (orderDateChanged) {
      const parsed = parseOrderDate(updatedChallan.orderDate);
      setYear(parsed.year);
      setMonth(parsed.month);
      saveActiveYear(parsed.year);
      saveActiveMonth(parsed.month);
      await loadActiveData(updatedList, updatedChallan.id, parsed.year, parsed.month);
    }
  };

  // Update Status helper for DCHub
  const handleUpdateDCStatus = async (challan: Challan, newStatus: StitchingStatus) => {
    await handleUpdateDC({ ...challan, status: newStatus });
  };

  // Delete DC (Real Supabase Deletion)
  const handleDeleteDC = async (challanId: string) => {
    await deleteChallan(challanId);
    const updatedList = await getChallans();
    setChallans(updatedList);
    const nextDC = updatedList[0]?.id || 'dc-3696';
    await handleSelectDC(nextDC);
  };

  // Add User (Persists directly to Supabase)
  const handleAddUser = async (userPayload: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }) => {
    await createRemoteUser(userPayload);
    const updated = await getRemoteUsers();
    setUsers(updated);
  };

  // Toggle User Active Status (Persists directly to Supabase)
  const handleToggleUserStatus = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const newStatus = !target.isActive;
    await updateRemoteUserStatus(userId, newStatus);
    const updated = await getRemoteUsers();
    setUsers(updated);
  };

  // Permanently Delete User (Persists directly to Supabase)
  const handleDeleteUser = async (userId: string) => {
    await deleteRemoteUser(userId);
    const updated = await getRemoteUsers();
    setUsers(updated);
    if (currentUser?.id === userId) {
      setCurrentUser(null);
      setCurrentUserState(null);
    }
  };

  // Reset User Password (Persists directly to Supabase)
  const handleResetPassword = async (userId: string, newPass: string) => {
    await resetRemoteUserPassword(userId, newPass);
    const updated = await getRemoteUsers();
    setUsers(updated);
  };

  // User Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setIsLoginModalOpen(false);
  };

  // User Login Success
  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUserState(user);
    setIsLoginModalOpen(false);

    try {
      const list = await getChallans();
      setChallans(list);
      const savedDC = getActiveDCId();
      const targetDC = list.some((c) => c.id === savedDC) ? savedDC : (list[0]?.id || 'dc-3696');
      setActiveDCIdState(targetDC);

      const active = list.find((c) => c.id === targetDC);
      if (active) {
        const parsed = parseOrderDate(active.orderDate);
        setYear(parsed.year);
        setMonth(parsed.month);
        await loadActiveData(list, targetDC, parsed.year, parsed.month);
      }

      const remoteList = await getRemoteUsers();
      if (remoteList && remoteList.length > 0) {
        setUsers(remoteList);
      }
    } catch (err) {
      console.warn('Post-login data fetch note:', err);
    }
  };

  // Active Challan
  const activeChallan = challans.find((c) => c.id === activeDCId) || challans[0];

  // 1. Initial authentication check screen
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <EyeLogo size={36} className="text-sky-400 animate-pulse" />
          <span className="font-black text-xl tracking-wider text-white">EYE PLANNING</span>
          <span className="bg-sky-500 text-slate-950 px-2 py-0.5 rounded text-[11px] font-black">
            DENIM CRAFTS
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
          <span>Verifying authorized credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Gateway: First show login page if not authenticated; enter only if credentials valid!
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Universal Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        challans={challans}
        activeDCId={activeDCId}
        onSelectDC={handleSelectDC}
        onOpenNewDC={() => {
          setEditingChallan(null);
          setIsNewDCModalOpen(true);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        isLiveConnected={isLiveConnected}
        lastLiveSyncTime={lastLiveSyncTime}
      />

      {/* Main Viewport Container - Edge-to-Edge Responsive & Fluid across all views */}
      <main className="flex-1 w-full px-2 sm:px-4 lg:px-6 py-3 sm:py-5 transition-all">
        {/* VIEW 1: PRODUCTION PLANNING REGISTER & BALANCES */}
        {activeView === 'register' && activeChallan && (
          <DateRegisterLedger
            key={`${activeChallan.id}_${activeChallan.orderDate}_${year}_${month}`}
            challan={activeChallan}
            initialRows={planningRows}
            year={year}
            month={month}
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            currentUser={currentUser}
            onOpenNewDC={() => {
              setEditingChallan(null);
              setIsNewDCModalOpen(true);
            }}
            onEditDC={() => {
              setEditingChallan(activeChallan);
              setIsNewDCModalOpen(true);
            }}
            onUpdateCurrentDC={handleUpdateDC}
            onDeleteCurrentDC={handleDeleteDC}
            onSaveRowsToServer={handleSaveRowsToServer}
            isLiveConnected={isLiveConnected}
            lastLiveSyncTime={lastLiveSyncTime}
            onManualSync={handleManualSync}
          />
        )}

        {/* VIEW 2: DELIVERY CHALLANS (DC) OVERVIEW HUB */}
        {activeView === 'challans' && (
          <DCHub
            challans={challans}
            onSelectDC={handleSelectDC}
            onOpenNewDC={() => {
              setEditingChallan(null);
              setIsNewDCModalOpen(true);
            }}
            onEditDC={(challan) => {
              setEditingChallan(challan);
              setIsNewDCModalOpen(true);
            }}
            onDeleteDC={handleDeleteDC}
            onUpdateDCStatus={handleUpdateDCStatus}
            currentUser={currentUser}
          />
        )}

        {/* VIEW 3: USER MANAGEMENT (Admin-Only Access) */}
        {activeView === 'admin' && (
          currentUser?.role?.toLowerCase() === 'admin' ? (
            <AdminUserManagement
              users={users}
              onAddUser={handleAddUser}
              onToggleStatus={handleToggleUserStatus}
              onDeleteUser={handleDeleteUser}
              onResetPassword={handleResetPassword}
              currentUser={currentUser}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md mx-auto text-center space-y-3 my-12 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
              <p className="text-xs text-slate-500">
                User Management is restricted to system administrators only.
              </p>
              <button
                onClick={() => setActiveView('challans')}
                className="mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Return to Delivery Challans
              </button>
            </div>
          )
        )}
      </main>

      {/* MODALS */}
      <NewDCModal
        key={isNewDCModalOpen ? (editingChallan?.id || 'new_dc') : 'closed'}
        isOpen={isNewDCModalOpen}
        onClose={() => {
          setIsNewDCModalOpen(false);
          setEditingChallan(null);
        }}
        onSaveDC={handleSaveDC}
        existingChallan={editingChallan}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
