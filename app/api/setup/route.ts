import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const { count: challanCount, error: challanError } = await supabaseAdmin
      .from('challans')
      .select('*', { count: 'exact', head: true });

    if (challanError) {
      return NextResponse.json({
        connected: false,
        hasTables: false,
        message: `Supabase error: ${challanError.message}`,
      });
    }

    const { count: entriesCount } = await supabaseAdmin
      .from('entries')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      connected: true,
      hasTables: true,
      challanCount: challanCount || 0,
      entriesCount: entriesCount || 0,
      message: `Supabase cloud database is connected! ${challanCount || 0} Delivery Challans and ${entriesCount || 0} production ledger entries found.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      connected: false,
      hasTables: false,
      message: `Connection failed: ${errorMsg}`,
    });
  }
}
