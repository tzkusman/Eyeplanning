'use client';

import React, { useState } from 'react';
import { UserProfile, UserRole } from '@/types';
import {
  Users,
  Shield,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  Mail,
  User,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
  KeyRound,
} from 'lucide-react';

interface AdminUserManagementProps {
  users: UserProfile[];
  currentUser: UserProfile | null;
  onAddUser: (user: { fullName: string; email: string; password: string; role: UserRole }) => Promise<void> | void;
  onToggleStatus?: (userId: string) => void;
  onToggleUserStatus?: (userId: string) => void;
  onDeleteUser: (userId: string) => Promise<void> | void;
  onResetPassword?: (userId: string, newPass: string) => Promise<void> | void;
}

export function AdminUserManagement({
  users,
  currentUser,
  onAddUser,
  onToggleUserStatus,
  onToggleStatus,
  onDeleteUser,
  onResetPassword,
}: AdminUserManagementProps) {
  const toggleHandler = onToggleStatus || onToggleUserStatus || (() => {});
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('operator');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password reset modal state
  const [resetTargetUser, setResetTargetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // User delete confirmation modal state
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  // Strict privilege check: non-admins cannot access this screen
  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto text-center space-y-4 shadow-sm my-8">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
          Administrator Access Required
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          User management and access provisioning can only be viewed and managed by authorized system administrators.
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setErrorNotice(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanName || !cleanEmail || !cleanPass) {
      setErrorNotice('Please fill in all required fields.');
      return;
    }

    if (cleanPass.length < 3) {
      setErrorNotice('Password must be at least 3 characters.');
      return;
    }

    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      setErrorNotice('A user with this email address or login ID already exists.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddUser({
        fullName: cleanName,
        email: cleanEmail,
        password: cleanPass,
        role,
      });

      setFullName('');
      setEmail('');
      setPassword('');
      setRole('operator');
      setShowAddForm(false);
      setNotice(`User account ${cleanEmail} created successfully! They can now log in with their email and password.`);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to create user. Please check server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetUser) return;
    setIsDeleting(true);
    try {
      await onDeleteUser(deleteTargetUser.id);
      setNotice(`User account ${deleteTargetUser.email} has been permanently deleted.`);
      setTimeout(() => setNotice(null), 4000);
      setDeleteTargetUser(null);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !onResetPassword) return;
    if (newPassword.trim().length < 3) {
      setErrorNotice('New password must be at least 3 characters.');
      return;
    }

    setIsResetting(true);
    try {
      await onResetPassword(resetTargetUser.id, newPassword.trim());
      setNotice(`Password for ${resetTargetUser.email} successfully updated.`);
      setTimeout(() => setNotice(null), 4000);
      setResetTargetUser(null);
      setNewPassword('');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to update password.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Privilege Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">
              User & Access Management
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Administrator console for creating user accounts, assigning roles, updating passwords, and managing access.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setErrorNotice(null);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showAddForm ? 'Close Form' : '+ Add New User'}</span>
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorNotice && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Add User Modal / Inline Form */}
      {showAddForm && (
        <div className="bg-slate-50 border border-sky-300 rounded-xl p-5 shadow-xs animate-in fade-in duration-150">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-sky-600" />
            <span>Create User Account (Admin, Manager, or Operator)</span>
          </h3>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1 text-[11px] uppercase">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Irshad"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 text-[11px] uppercase">
                Email / Login ID <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. irshad@denimcraft.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 text-[11px] uppercase">
                Assign Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 text-[11px] uppercase">
                Role Assignment <span className="text-rose-500">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold text-xs"
              >
                <option value="operator">Operator (Floor Output Entry)</option>
                <option value="manager">Manager (DC Planning & Outputs)</option>
                <option value="admin">Admin (Full System Rights)</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Rights Summary Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Administrator</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Full rights: create & delete users, set passwords, create and edit DCs, manage full production database.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Production Manager</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Planning authority: schedule daily Expected Outputs, create new DCs, monitor running balance.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Floor Operator</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Floor recording: log daily Actual Outputs, view target balance down to lot completion.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Authorized Personnel ({users.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Full Name</th>
                <th className="py-2.5 px-4">Email / Login ID</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Security</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isPrimaryAdmin = u.email === 'admin@denimcrafts.com' || u.id === 'usr-admin-primary';
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{u.fullName}</span>
                        {isPrimaryAdmin && (
                          <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.5 rounded font-black">
                            Primary Admin
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700">
                      {u.email}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : u.role === 'manager'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Protected</span>
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          u.isActive ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {u.isActive ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Deactivated</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {/* Reset Password Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(u);
                            setNewPassword('');
                            setErrorNotice(null);
                          }}
                          className="text-xs text-sky-600 hover:text-sky-800 font-semibold cursor-pointer inline-flex items-center gap-1"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset Pass</span>
                        </button>

                        {/* Toggle Active / Deactivate */}
                        {!isPrimaryAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleHandler(u.id)}
                            className={`text-xs font-semibold cursor-pointer transition-colors ${
                              u.isActive
                                ? 'text-amber-600 hover:text-amber-800'
                                : 'text-emerald-600 hover:text-emerald-800'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}

                        {/* Delete User */}
                        {!isPrimaryAdmin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTargetUser(u);
                              setErrorNotice(null);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer inline-flex items-center gap-1"
                            title="Permanently Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Permanent</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h4 className="font-black text-sm uppercase tracking-wide">Delete User Account</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-slate-900 font-bold">{deleteTargetUser.fullName}</strong> (
              <span className="font-mono">{deleteTargetUser.email}</span>)?
              This account will be permanently removed from the system.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:bg-slate-400 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmResetPassword}
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-sky-600">
              <KeyRound className="w-5 h-5" />
              <h4 className="font-black text-sm uppercase tracking-wide">Reset Password</h4>
            </div>
            <p className="text-xs text-slate-600">
              Set a new password for <strong className="text-slate-900">{resetTargetUser.fullName}</strong> ({resetTargetUser.email}):
            </p>
            <div>
              <input
                type="password"
                placeholder="Enter new password (min 3 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResetting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
