import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function extractStitchingStatus(statusVal?: unknown, remarksVal?: unknown): 'Process' | 'Inline' | 'Complete' {
  const remarksStr = remarksVal ? String(remarksVal) : '';
  const tagMatch = remarksStr.match(/\[STITCHING:(Process|Inline|Complete)\]/i);
  if (tagMatch) {
    const val = tagMatch[1].toUpperCase();
    if (val === 'COMPLETE') return 'Complete';
    if (val === 'INLINE') return 'Inline';
    return 'Process';
  }

  const s = statusVal ? String(statusVal).trim().toUpperCase() : '';
  if (s === 'COMPLETE' || s === 'COMPLETED' || s === 'CLOSED') return 'Complete';
  if (s === 'INLINE' || s === 'IN-LINE' || s === 'QC') return 'Inline';
  return 'Process';
}

function cleanRemarks(remarksVal?: unknown): string | undefined {
  if (!remarksVal) return undefined;
  const s = String(remarksVal).replace(/\[STITCHING:(Process|Inline|Complete)\]\s*/i, '').trim();
  return s || undefined;
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('challans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 200 });
    }

    const challans = (data || []).map((item: Record<string, unknown>) => ({
      id: String(item.id),
      dcNo: String(item.dc_no),
      party: String(item.party || ''),
      article: String(item.article || ''),
      openingQty: Number(item.opening_qty || 0),
      orderDate: String(item.open_date || item.order_date || ''),
      notes: cleanRemarks(item.remarks || item.notes),
      status: extractStitchingStatus(item.status, item.remarks || item.notes),
      createdBy: String(item.created_by_id || item.created_by || 'usr-admin-1'),
      createdAt: String(item.created_at || ''),
      updatedAt: String(item.updated_at || ''),
    }));

    return NextResponse.json({ success: true, data: challans });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg, data: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dcNo, party, article, openingQty, orderDate, notes, status } = body;

    if (!dcNo || !party || !openingQty) {
      return NextResponse.json(
        { success: false, error: 'DC Number, Line or Assembly, and Opening Qty are required.' },
        { status: 400 }
      );
    }

    const cleanStatus: 'Process' | 'Inline' | 'Complete' =
      status === 'Complete' || status === 'COMPLETED' || status === 'CLOSED'
        ? 'Complete'
        : status === 'Inline'
        ? 'Inline'
        : 'Process';

    const newId = `dc-${String(dcNo).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || Date.now()}`;
    const cleanNotes = notes ? String(notes).trim() : '';

    // Primary attempt: try writing direct Stitching Status ('Process' | 'Inline' | 'Complete')
    let payload: Record<string, unknown> = {
      id: newId,
      dc_no: String(dcNo).trim().toUpperCase(),
      party: String(party).trim(),
      article: article ? String(article).trim() : 'Garment Batch',
      opening_qty: Number(openingQty),
      open_date: orderDate || new Date().toISOString().split('T')[0],
      remarks: cleanNotes || null,
      status: cleanStatus,
      created_by_id: 'usr-admin-1',
    };

    let { data, error } = await supabaseAdmin
      .from('challans')
      .insert(payload)
      .select()
      .single();

    // If database check constraint fails because user hasn't run the SQL migration yet:
    if (error && (error.message.includes('challans_status_check') || error.code === '23514')) {
      const fallbackStatus = cleanStatus === 'Complete' ? 'CLOSED' : 'OPEN';
      const taggedRemarks = `[STITCHING:${cleanStatus}] ${cleanNotes}`.trim();

      payload = {
        ...payload,
        status: fallbackStatus,
        remarks: taggedRemarks || null,
      };

      const retry = await supabaseAdmin
        .from('challans')
        .insert(payload)
        .select()
        .single();

      if (!retry.error && retry.data) {
        data = {
          ...retry.data,
          status: cleanStatus,
        };
        error = null;
      } else if (retry.error) {
        error = retry.error;
      }
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const createdChallan = {
      id: String(data.id),
      dcNo: String(data.dc_no),
      party: String(data.party),
      article: String(data.article || ''),
      openingQty: Number(data.opening_qty),
      orderDate: String(data.open_date || data.order_date || ''),
      notes: cleanRemarks(data.remarks),
      status: cleanStatus,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };

    return NextResponse.json({ success: true, data: createdChallan });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
