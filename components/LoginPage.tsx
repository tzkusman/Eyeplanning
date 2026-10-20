'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { authenticateUser } from '@/lib/storage';
import { EyeLogo } from './EyeLogo';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setError('Please enter both your email address/login ID and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authenticateUser(cleanEmail, cleanPass);
      setIsSubmitting(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(
          result.error ||
            'Invalid credentials. Public registration is disabled. Only authorized administrator-created accounts can sign in.'
        );
      }
    } catch {
      setIsSubmitting(false);
      setError('Unable to reach authentication server. Please check your network and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Subtle Gradient & Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="bg-slate-900 text-white p-7 text-center border-b border-slate-800 relative">
          <div className="inline-flex items-center justify-center gap-2 mb-3">
            <EyeLogo size={28} className="text-sky-400" />
            <span className="text-white font-black text-base tracking-wide">EYE PLANNING</span>
            <span className="bg-sky-500 text-slate-950 px-2 py-0.5 rounded text-[11px] font-black tracking-tight">
              DENIM CRAFTS
            </span>
          </div>
          <h1 className="text-sm font-black uppercase tracking-wider text-slate-100">
            Production Management System
          </h1>
          <p className="mt-1.5 text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Please sign in with your authorized company credentials to access delivery challans & planning registers.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1.5 text-xs uppercase tracking-wider">
              Email Address / Login ID <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. admin@denimcrafts.com or irshad"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                className="w-full pl-10 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none bg-slate-50 focus:bg-white text-slate-900 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5 text-xs uppercase tracking-wider">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none bg-slate-50 focus:bg-white text-slate-900 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 mt-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to System</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Access Policy Note */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Restricted Enterprise Portal</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
              Public self-registration is strictly disabled. New user credentials are created exclusively by the System Administrator in User Management.
            </p>
          </div>
        </form>
      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-400">Denim Crafts ERP Production Suite</p>
        <p className="text-[11px] text-slate-600 mt-0.5">Secure SSL Enterprise Database & Cloud Sync</p>
      </div>
    </div>
  );
}
