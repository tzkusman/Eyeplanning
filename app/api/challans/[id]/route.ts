import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function cleanRemarks(remarksVal?: unknown): string | undefined {
  if (!remarksVal) return undefined;
  const s = String(remarksVal).replace(/\[STITCHING:(Process|Inline|Complete)\]\s*/i, '').trim();
  return s || undefined;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dcNo, party, article, openingQty, orderDate, notes, status } = body;

    const cleanStatus: 'Process' | 'Inline' | 'Complete' =
      status === 'Complete' || status === 'COMPLETED' || status === 'CLOSED'
        ? 'Complete'
        : status === 'Inline'
        ? 'Inline'
        : 'Process';

    const cleanNotes = notes !== undefined ? String(notes).trim() : undefined;

    // 1. Try updating directly with the StitchingStatus value
    const updatePayload: Record<string, unknown> = {
      dc_no: dcNo ? String(dcNo).trim().toUpperCase() : undefined,
      party: party ? String(party).trim() : undefined,
      article: article ? String(article).trim() : undefined,
      opening_qty: openingQty ? Number(openingQty) : undefined,
      open_date: orderDate || undefined,
      remarks: cleanNotes !== undefined ? (cleanNotes || null) : undefined,
      status: cleanStatus,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabaseAdmin
      .from('challans')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    // 2. If check constraint fails in Supabase, gracefully fallback to OPEN/CLOSED + tagged remarks
    if (error && (error.message.includes('challans_status_check') || error.code === '23514')) {
      const fallbackStatus = cleanStatus === 'Complete' ? 'CLOSED' : 'OPEN';
      const taggedRemarks = `[STITCHING:${cleanStatus}] ${cleanNotes || ''}`.trim();

      const retry = await supabaseAdmin
        .from('challans')
        .update({
          ...updatePayload,
          status: fallbackStatus,
          remarks: taggedRemarks || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (!retry.error && retry.data) {
        data = {
          ...retry.data,
          status: cleanStatus,
          remarks: cleanRemarks(retry.data.remarks),
        };
        error = null;
      } else if (retry.error) {
        error = retry.error;
      }
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        status: cleanStatus,
        notes: cleanRemarks(data?.remarks),
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete related entries from entries table
    try {
      await supabaseAdmin.from('entries').delete().eq('challan_id', id);
    } catch {
      // ignore
    }

    // Also delete from planning_schedules if it exists
    try {
      await supabaseAdmin.from('planning_schedules').delete().eq('challan_id', id);
    } catch {
      // ignore
    }

    // Delete challan record
    const { error } = await supabaseAdmin.from('challans').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Challan ${id} deleted successfully.` });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
