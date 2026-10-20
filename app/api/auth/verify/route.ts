import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { UserProfile } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');
    const email = searchParams.get('email')?.toLowerCase().trim();

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, valid: false, error: 'User ID or email is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch current users list from Supabase
    const { data: settingRow } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'auth_users')
      .maybeSingle();

    let users: (UserProfile & { passwordHash?: string })[] = [];
    if (settingRow && Array.isArray(settingRow.value)) {
      users = settingRow.value;
    }

    // 2. Allow primary default admin if settings is unseeded
    if (
      (email === 'admin@denimcrafts.com' || userId === 'usr-admin-primary') &&
      !users.some((u) => u.email.toLowerCase() === 'admin@denimcrafts.com')
    ) {
      return NextResponse.json({
        success: true,
        valid: true,
        user: {
          id: 'usr-admin-primary',
          email: 'admin@denimcrafts.com',
          fullName: 'System Administrator',
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      });
    }

    // 3. Find user
    const matched = users.find(
      (u) =>
        (userId && u.id === userId) ||
        (email && (u.email || '').toLowerCase().trim() === email)
    );

    if (!matched) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'User account has been deleted or does not exist.',
      });
    }

    if (!matched.isActive) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'User account has been deactivated.',
      });
    }

    const safeUser: UserProfile = {
      id: matched.id,
      email: matched.email,
      fullName: matched.fullName,
      role: matched.role,
      isActive: matched.isActive,
      createdAt: matched.createdAt,
    };

    return NextResponse.json({
      success: true,
      valid: true,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Session verify error:', err);
    return NextResponse.json(
      { success: false, valid: false, error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
