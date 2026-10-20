import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { UserProfile, UserRole } from '@/types';

// Default baseline user (clean generic ERP system administrator)
const INITIAL_USERS: (UserProfile & { passwordHash: string })[] = [
  {
    id: 'usr-admin-primary',
    email: 'admin@denimcrafts.com',
    fullName: 'System Administrator',
    role: 'admin',
    isActive: true,
    passwordHash: 'admin123',
    createdAt: '2026-10-12T09:56:16.622Z',
  },
];

/**
 * Sanitizes user objects by stripping sensitive passwordHash fields before sending to client.
 */
function sanitizeUser(u: UserProfile & { passwordHash?: string }): UserProfile {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive !== false,
    createdAt: u.createdAt || new Date().toISOString(),
  };
}

/**
 * GET /api/users
 * Retrieves all registered users from Supabase.
 * Strips all password hashes before returning.
 */
export async function GET() {
  try {
    const { data: settingRow, error: settingError } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'auth_users')
      .maybeSingle();

    if (settingError) {
      console.error('Error fetching auth_users from settings:', settingError);
    }

    let usersList: (UserProfile & { passwordHash?: string })[] = [];

    if (settingRow && Array.isArray(settingRow.value) && settingRow.value.length > 0) {
      usersList = settingRow.value;
    } else {
      // Seed default admin if settings row is empty
      usersList = [...INITIAL_USERS];
      await supabaseAdmin.from('settings').upsert({
        key: 'auth_users',
        value: usersList,
        updated_at: new Date().toISOString(),
      });
    }

    // Ensure system admin is always present in usersList
    if (!usersList.some((u) => (u.email || '').toLowerCase().trim() === 'admin@denimcrafts.com')) {
      usersList.unshift(INITIAL_USERS[0]);
    }

    // Return sanitized users (NEVER expose passwordHash to frontend)
    const sanitized = usersList.map(sanitizeUser);
    return NextResponse.json({ success: true, users: sanitized });
  } catch (err: any) {
    console.error('API /api/users GET error:', err);
    return NextResponse.json({ success: true, users: INITIAL_USERS.map(sanitizeUser) });
  }
}

/**
 * POST /api/users
 * Admin adds a new user with email, password, full name, and role.
 * Persists directly to Supabase settings (auth_users) and profiles.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, password, role } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Full name, email/username, and password are required.' },
        { status: 400 }
      );
    }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const cleanRole = (role || 'operator').toLowerCase() as UserRole;

    if (cleanPass.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 3 characters long.' },
        { status: 400 }
      );
    }

    // 1. Fetch current users list
    const { data: settingRow } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'auth_users')
      .maybeSingle();

    let currentUsers: (UserProfile & { passwordHash: string })[] = [];
    if (settingRow && Array.isArray(settingRow.value) && settingRow.value.length > 0) {
      currentUsers = settingRow.value;
    } else {
      currentUsers = [...INITIAL_USERS];
    }

    // 2. Check for existing email/username
    const existingIndex = currentUsers.findIndex(
      (u) => u.email.toLowerCase().trim() === cleanEmail
    );

    const newUserObj: UserProfile & { passwordHash: string } = {
      id: existingIndex >= 0 ? currentUsers[existingIndex].id : `usr-${Date.now()}`,
      fullName: cleanName,
      email: cleanEmail,
      role: cleanRole,
      isActive: true,
      passwordHash: cleanPass,
      createdAt: existingIndex >= 0 ? currentUsers[existingIndex].createdAt : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      currentUsers[existingIndex] = newUserObj;
    } else {
      currentUsers.push(newUserObj);
    }

    // 3. Persist to Supabase settings
    const { error: upsertSettingError } = await supabaseAdmin.from('settings').upsert({
      key: 'auth_users',
      value: currentUsers,
      updated_at: new Date().toISOString(),
    });

    if (upsertSettingError) {
      console.error('Supabase settings upsert error:', upsertSettingError);
      throw new Error(upsertSettingError.message);
    }

    // 4. Best-effort sync to profiles table
    try {
      const profileRole =
        cleanRole === 'admin' ? 'ADMIN' : cleanRole === 'manager' ? 'MANAGER' : 'OPERATOR';

      await supabaseAdmin.from('profiles').upsert(
        {
          id: newUserObj.id,
          full_name: newUserObj.fullName,
          email: newUserObj.email,
          role: profileRole,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
    } catch (syncErr) {
      console.warn('Profile sync optional note:', syncErr);
    }

    return NextResponse.json({
      success: true,
      user: sanitizeUser(newUserObj),
    });
  } catch (err: any) {
    console.error('API /api/users POST error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create user.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users
 * Admin permanently deletes a user account.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get('id');

    if (!userId) {
      try {
        const body = await req.json();
        userId = body.userId;
      } catch {
        // ignore
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required for deletion.' },
        { status: 400 }
      );
    }

    // 1. Fetch current users list
    const { data: settingRow } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'auth_users')
      .maybeSingle();

    if (!settingRow || !Array.isArray(settingRow.value)) {
      return NextResponse.json(
        { success: false, error: 'No user registry found.' },
        { status: 404 }
      );
    }

    const currentUsers: (UserProfile & { passwordHash: string })[] = settingRow.value;
    const targetUser = currentUsers.find((u) => u.id === userId);

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found in database.' },
        { status: 404 }
      );
    }

    // Prevent deleting the primary admin account
    if (targetUser.email === 'admin@denimcrafts.com' || targetUser.id === 'usr-admin-primary') {
      return NextResponse.json(
        { success: false, error: 'Primary system administrator cannot be deleted.' },
        { status: 400 }
      );
    }

    // Filter out the deleted user
    const updatedUsers = currentUsers.filter((u) => u.id !== userId);

    // 2. Persist updated list to Supabase settings
    await supabaseAdmin.from('settings').upsert({
      key: 'auth_users',
      value: updatedUsers,
      updated_at: new Date().toISOString(),
    });

    // 3. Delete from profiles table
    try {
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.from('profiles').delete().eq('email', targetUser.email);
    } catch (delErr) {
      console.warn('Profile delete note:', delErr);
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.email} permanently deleted.`,
      deletedUserId: userId,
    });
  } catch (err: any) {
    console.error('API /api/users DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete user.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users
 * Admin updates user status (active/deactivated) or resets password.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, isActive, password } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required.' },
        { status: 400 }
      );
    }

    const { data: settingRow } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'auth_users')
      .maybeSingle();

    if (!settingRow || !Array.isArray(settingRow.value)) {
      return NextResponse.json(
        { success: false, error: 'No user registry found in database.' },
        { status: 404 }
      );
    }

    const users: (UserProfile & { passwordHash: string })[] = settingRow.value;
    const target = users.find((u) => u.id === userId);

    if (!target) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (typeof isActive === 'boolean') {
      target.isActive = isActive;
    }
    if (password && typeof password === 'string' && password.trim().length > 0) {
      target.passwordHash = password.trim();
    }

    await supabaseAdmin.from('settings').upsert({
      key: 'auth_users',
      value: users,
      updated_at: new Date().toISOString(),
    });

    if (typeof isActive === 'boolean') {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', userId);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ success: true, user: sanitizeUser(target) });
  } catch (err: any) {
    console.error('API /api/users PATCH error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update user.' },
      { status: 500 }
    );
  }
}
