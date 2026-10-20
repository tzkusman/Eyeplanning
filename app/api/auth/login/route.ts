import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { UserProfile } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email or login ID and password are required.' },
        { status: 400 }
      );
    }

    const cleanInput = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Fetch user accounts from Supabase settings
    let users: (UserProfile & { passwordHash?: string })[] = [];
    try {
      const { data: settingRow } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'auth_users')
        .maybeSingle();

      if (settingRow && Array.isArray(settingRow.value)) {
        users = settingRow.value;
      }
    } catch (dbErr) {
      console.warn('Could not read auth_users setting:', dbErr);
    }

    // 2. Primary Admin default fallback if settings is empty or not yet loaded
    if (
      (cleanInput === 'admin@denimcrafts.com' || cleanInput === 'admin') &&
      cleanPass === 'admin123' &&
      !users.some((u) => u.email.toLowerCase() === 'admin@denimcrafts.com')
    ) {
      const adminUser: UserProfile = {
        id: 'usr-admin-primary',
        email: 'admin@denimcrafts.com',
        fullName: 'System Administrator',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, user: adminUser });
    }

    // 3. Find matching user by email (or username portion before @)
    const matched = users.find((u) => {
      const userEmail = (u.email || '').toLowerCase().trim();
      const username = userEmail.split('@')[0];
      return userEmail === cleanInput || username === cleanInput;
    });

    if (!matched) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid credentials. Only administrator-created accounts can sign in. Please verify your email and password.',
        },
        { status: 401 }
      );
    }

    if (!matched.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account has been deactivated by the system administrator.',
        },
        { status: 403 }
      );
    }

    // Check password
    if (matched.passwordHash && matched.passwordHash !== cleanPass) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid password. Please check your password and try again.',
        },
        { status: 401 }
      );
    }

    const safeUser: UserProfile = {
      id: matched.id,
      email: matched.email,
      fullName: matched.fullName,
      role: matched.role,
      isActive: matched.isActive,
      createdAt: matched.createdAt,
    };

    return NextResponse.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error('API /api/auth/login error:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication service temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
