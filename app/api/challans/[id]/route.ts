import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function cleanRemarks(remarksVal?: unknown): string | undefined {
  if (!remarksVal) return undefined;
  const s = String(remarksVal)
    .replace(/\[STITCHING:(Process|Inline|Complete)\]\s*/gi, '')
    .replace(/\[ITEM:[^\]]+\]\s*/gi, '')
    .replace(/\[EXPECTED_START:[^\]]+\]\s*/gi, '')
    .replace(/\[EXPECTED_RATE:\d+\]\s*/gi, '')
    .trim();
  return s || undefined;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      dcNo,
      party,
      article,
      item,
      openingQty,
      orderDate,
      firstExpectedDate,
      dailyExpectedRate,
      notes,
      status,
    } = body;

    const cleanStatus: 'Process' | 'Inline' | 'Complete' =
      status === 'Complete' || status === 'COMPLETED' || status === 'CLOSED'
        ? 'Complete'
        : status === 'Inline'
        ? 'Inline'
        : 'Process';

    const cleanNotes = notes !== undefined ? String(notes).trim() : undefined;
    const cleanItem = item !== undefined ? (item ? String(item).trim() : null) : undefined;
    const cleanFirstExpectedDate =
      firstExpectedDate !== undefined ? (firstExpectedDate ? String(firstExpectedDate).trim() : null) : undefined;
    const cleanDailyExpectedRate =
      dailyExpectedRate !== undefined
        ? (dailyExpectedRate && Number(dailyExpectedRate) > 0 ? Number(dailyExpectedRate) : null)
        : undefined;

    // 1. Try updating directly with the new columns
    const updatePayload: Record<string, unknown> = {
      dc_no: dcNo ? String(dcNo).trim().toUpperCase() : undefined,
      party: party ? String(party).trim() : undefined,
      article: article ? String(article).trim() : undefined,
      item: cleanItem,
      opening_qty: openingQty ? Number(openingQty) : undefined,
      open_date: orderDate || undefined,
      first_expected_date: cleanFirstExpectedDate,
      daily_expected_rate: cleanDailyExpectedRate,
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

    // 2. If error due to missing columns or check constraint, fallback gracefully
    if (error) {
      const isMissingColumn =
        error.code === '42703' ||
        error.message.includes('column "item"') ||
        error.message.includes('column "first_expected_date"') ||
        error.message.includes('column "daily_expected_rate"');
      const isConstraintErr =
        error.message.includes('challans_status_check') || error.code === '23514';

      if (isMissingColumn || isConstraintErr) {
        const fallbackStatus = isConstraintErr
          ? cleanStatus === 'Complete'
            ? 'CLOSED'
            : 'OPEN'
          : cleanStatus;

        const metaTags = [
          cleanStatus !== 'Process' ? `[STITCHING:${cleanStatus}]` : '',
          cleanItem ? `[ITEM:${cleanItem}]` : '',
          cleanFirstExpectedDate ? `[EXPECTED_START:${cleanFirstExpectedDate}]` : '',
          cleanDailyExpectedRate ? `[EXPECTED_RATE:${cleanDailyExpectedRate}]` : '',
        ].filter(Boolean).join(' ');

        const taggedRemarks = [metaTags, cleanNotes || ''].filter(Boolean).join(' ').trim();

        const fallbackPayload: Record<string, unknown> = {
          dc_no: dcNo ? String(dcNo).trim().toUpperCase() : undefined,
          party: party ? String(party).trim() : undefined,
          article: article ? String(article).trim() : undefined,
          opening_qty: openingQty ? Number(openingQty) : undefined,
          open_date: orderDate || undefined,
          remarks: taggedRemarks || null,
          status: fallbackStatus,
          updated_at: new Date().toISOString(),
        };

        const retry = await supabaseAdmin
          .from('challans')
          .update(fallbackPayload)
          .eq('id', id)
          .select()
          .single();

        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        } else if (retry.error) {
          error = retry.error;
        }
      }
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        item: cleanItem !== undefined ? cleanItem : data?.item,
        firstExpectedDate: cleanFirstExpectedDate !== undefined ? cleanFirstExpectedDate : data?.first_expected_date,
        dailyExpectedRate: cleanDailyExpectedRate !== undefined ? cleanDailyExpectedRate : data?.daily_expected_rate,
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
