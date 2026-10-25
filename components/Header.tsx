'use client';

import React from 'react';
import { Challan, UserProfile } from '@/types';
import { TableProperties, Layers, Users, Plus, LogOut } from 'lucide-react';
import { EyeLogo } from './EyeLogo';

interface HeaderProps {
  activeView: 'register' | 'challans' | 'admin';
  setActiveView: (view: 'register' | 'challans' | 'admin') => void;
  challans: Challan[];
  activeDCId: string;
  onSelectDC: (dcId: string) => void;
  onOpenNewDC: () => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  onOpenLogin?: () => void;
  isLiveConnected?: boolean;
  lastLiveSyncTime?: string | null;
}

export function Header({
  activeView,
  setActiveView,
  challans,
  activeDCId,
  onSelectDC,
  onOpenNewDC,
  currentUser,
  onLogout,
  onOpenLogin,
  isLiveConnected = true,
  lastLiveSyncTime,
}: HeaderProps) {
  const activeChallan = challans.find((c) => c.id === activeDCId) || challans[0];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      {/* Top utility ribbon */}
      <div className="w-full px-3 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-sky-400">
            {/* Custom EYE Vector SVG Branding */}
            <EyeLogo size={24} className="text-sky-400" />
            <span className="text-white font-black tracking-tight text-sm">EYE PLANNING</span>
            <span className="bg-sky-500 text-slate-950 font-black px-1.5 py-0.5 rounded text-[10px] tracking-tight">
              DENIM CRAFTS
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">Karachi Manufacturing Unit</span>

          {/* Live Sync Status Pill */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isLiveConnected
                ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/80'
                : 'bg-amber-950/70 text-amber-400 border-amber-800/80'
            }`}
            title="Real-time live sync connected with Supabase database"
          >
            <span className="relative flex h-1.5 w-1.5">
              {isLiveConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              ></span>
            </span>
            <span>{isLiveConnected ? 'LIVE SYNC ACTIVE' : 'CONNECTING...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Current User or Sign In */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">
                {currentUser.fullName}
              </span>
              <span className="uppercase text-[10px] tracking-wide font-semibold px-1.5 py-0.5 bg-slate-800 text-sky-300 rounded border border-slate-700">
                {currentUser.role}
              </span>
              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-400 transition-colors p-1 cursor-pointer flex items-center gap-1 text-[11px]"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs transition-colors cursor-pointer"
            >
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Main navigation & DC Switcher */}
      <div className="w-full px-3 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveView('challans')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeView === 'challans'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All DCs ({challans.length})</span>
          </button>

          <button
            onClick={() => setActiveView('register')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeView === 'register'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            <span>Date-Wise Production Ledger</span>
          </button>

          {currentUser?.role?.toLowerCase() === 'admin' && (
            <button
              onClick={() => setActiveView('admin')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeView === 'admin'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Management</span>
            </button>
          )}
        </div>

        {/* DC Switcher dropdown & New DC button */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Active DC:</span>
            <select
              value={activeChallan?.id || ''}
              onChange={(e) => onSelectDC(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer pr-1"
            >
              {challans.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  DC #{c.dcNo} - {c.party} ({c.openingQty.toLocaleString()} pcs)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenNewDC}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md shadow-xs transition-colors text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Open New DC</span>
          </button>
        </div>
      </div>
    </header>
  );
}
