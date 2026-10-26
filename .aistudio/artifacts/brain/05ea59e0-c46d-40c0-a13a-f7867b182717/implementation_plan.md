# Strict Session Security & Logout Enforcement Architecture

Comprehensive fix for enterprise session isolation, multi-layer logout purging, and zero-bypass login portal in the EYE Planning ERP application.

---

### 1. Root Cause Analysis

1. **SSR Memory Leak across Requests**:
   - In Next.js App Router, module-level memory variables in `lib/storage.ts` run inside the persistent Node.js server process.
   - When SSR executed, `typeof window === 'undefined'` fell back to `memoryFallbackStore.get()`.
   - When the client's `handleLogout()` cleared only the browser's storage, the Node.js server process retained the user session in its fallback store and served authenticated SSR HTML on page reload/refresh.

2. **Absence of an Explicit Logout Tombstone**:
   - Without an explicit logout tombstone flag, any stale cache in browser or server memory could be re-read by `getCurrentUser()` during initialization.

3. **Pre-filled Quick Select Credentials in UI**:
   - `LoginPage.tsx` contained "Quick Select Authorized Profile" buttons that pre-filled credentials, violating enterprise security rules and enabling accidental single-click auto-sign-ins.

---

### 2. Solutions Implemented

1. **Strict SSR Isolation in `safeStorage`**:
   - `safeStorage.getItem` now returns `null` immediately when `typeof window === 'undefined'`.
   - The Node.js server process never returns or leaks user session credentials across SSR requests.

2. **Explicit Multi-Layer Logout Tombstone (`eye_erp_logged_out`)**:
   - Calling `setCurrentUser(null)` / `handleLogout()`:
     - Sets `'eye_erp_logged_out': 'true'` across `localStorage`, `sessionStorage`, and memory.
     - Irreversibly purges `STORAGE_KEYS.CURRENT_USER` from all storage layers.
   - `getCurrentUser()` checks `'eye_erp_logged_out'` first: if set to `'true'`, it immediately returns `null`.
   - Only a valid, successful authentication via `setCurrentUser(user)` clears the `'eye_erp_logged_out'` flag.

3. **Zero-Bypass Gateway & Auth Splash in `app/page.tsx`**:
   - Added `isAuthChecking` state to avoid hydration mismatch flashes.
   - If `!currentUser`, the application renders `LoginPage` exclusively. There is zero auto-login or fallback to default accounts.
   - When a user logs out, `handleLogout` resets `currentUserState(null)` and `isAuthChecking(false)`, locking the app to `LoginPage`.

4. **Hardened Login Gateway (`LoginPage.tsx`)**:
   - Completely removed the "Quick Select Authorized Profile" buttons.
   - Users must manually enter their authorized Email / Login ID and password to access production challans and planning registers.
