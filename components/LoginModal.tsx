'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { authenticateUser } from '@/lib/storage';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { EyeLogo } from './EyeLogo';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess?: (user: UserProfile) => void;
  onLoginSuccess?: (user: UserProfile) => void;
  onClose?: () => void;
}

export function LoginModal({ isOpen, onSuccess, onLoginSuccess, onClose }: LoginModalProps) {
  const handleSuccess = onLoginSuccess || onSuccess || (() => {});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setError('Please enter both your email/login ID and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authenticateUser(cleanEmail, cleanPass);
      setIsSubmitting(false);

      if (result.success && result.user) {
        handleSuccess(result.user);
      } else {
        setError(result.error || 'Invalid credentials. Only administrator-created accounts can sign in.');
      }
    } catch {
      setIsSubmitting(false);
      setError('Failed to authenticate. Please check your network and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full cursor-pointer z-10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="bg-slate-900 text-white p-6 text-center border-b border-slate-800">
          <div className="inline-flex items-center justify-center gap-2 mb-2 font-black tracking-wider text-sky-400 text-sm">
            <EyeLogo size={22} className="text-sky-400" />
            <span className="text-white font-black text-sm">EYE PLANNING</span>
            <span className="bg-sky-500 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight">
              DENIM CRAFTS
            </span>
          </div>
          <h2 className="text-base font-black uppercase tracking-wide text-white">
            Production System Sign In
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Authorized access only. Accounts are created exclusively by the System Administrator.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-start gap-2 font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1 text-[11px] uppercase tracking-wider">
              Email Address or Login ID <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. admin@denimcrafts.com or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1 text-[11px] uppercase tracking-wider">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none font-mono bg-slate-50 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 mt-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to System</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
            Public registration is disabled. Accounts can only be provisioned by the Administrator from the User Management console.
          </p>
        </form>
      </div>
    </div>
  );
}
