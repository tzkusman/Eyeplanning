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

function extractMetadata(item: Record<string, unknown>) {
  const remarksStr = item.remarks ? String(item.remarks) : item.notes ? String(item.notes) : '';

  // Item field (e.g. Skirt, Jacket, Jeans)
  let itemVal = item.item ? String(item.item).trim() : '';
  if (!itemVal) {
    const itemMatch = remarksStr.match(/\[ITEM:([^\]]+)\]/i);
    if (itemMatch) itemVal = itemMatch[1].trim();
  }

  // First expected date
  let firstExpectedDate = item.first_expected_date ? String(item.first_expected_date).trim() : undefined;
  if (!firstExpectedDate) {
    const startMatch = remarksStr.match(/\[EXPECTED_START:([^\]]+)\]/i);
    if (startMatch) firstExpectedDate = startMatch[1].trim();
  }

  // Daily expected rate
  let dailyExpectedRate: number | undefined = undefined;
  if (item.daily_expected_rate !== undefined && item.daily_expected_rate !== null) {
    const num = Number(item.daily_expected_rate);
    if (!isNaN(num) && num > 0) dailyExpectedRate = num;
  }
  if (dailyExpectedRate === undefined) {
    const rateMatch = remarksStr.match(/\[EXPECTED_RATE:(\d+)\]/i);
    if (rateMatch) dailyExpectedRate = parseInt(rateMatch[1], 10);
  }

  const cleanStatus = extractStitchingStatus(item.status, remarksStr);

  return {
    itemVal: itemVal || undefined,
    firstExpectedDate,
    dailyExpectedRate,
    status: cleanStatus,
  };
}

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

export async function GET() {
  try {
    const [challansRes, entriesRes] = await Promise.all([
      supabaseAdmin
        .from('challans')
        .select('*')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('entries')
        .select('challan_id, type, qty, note'),
    ]);

    if (challansRes.error) {
      return NextResponse.json({ success: false, error: challansRes.error.message, data: [] }, { status: 200 });
    }

    // Aggregate production outputs and extra inputs by challan_id
    const statsByChallan: Record<string, { totalActual: number; extraInput: number }> = {};
    if (!entriesRes.error && Array.isArray(entriesRes.data)) {
      entriesRes.data.forEach((e: Record<string, unknown>) => {
        const cId = String(e.challan_id || '');
        if (!cId) return;
        if (!statsByChallan[cId]) {
          statsByChallan[cId] = { totalActual: 0, extraInput: 0 };
        }
        const qty = Number(e.qty || 0);
        const type = String(e.type || '').toUpperCase();
        const note = String(e.note || '');

        if (type === 'IN') {
          statsByChallan[cId].extraInput += qty;
        } else if (type === 'OUT') {
          const isNoActual = note.includes('NO_ACTUAL:1') || note.includes('ACTUAL:NONE');
          const actualMatch = note.match(/ACTUAL:(-?\d+)/i);
          if (isNoActual) {
            // null / skipped
          } else if (actualMatch) {
            statsByChallan[cId].totalActual += Number(actualMatch[1]);
          } else if (qty > 0) {
            statsByChallan[cId].totalActual += qty;
          }
        }
      });
    }

    const challans = (challansRes.data || []).map((item: Record<string, unknown>) => {
      const meta = extractMetadata(item);
      const openingQty = Number(item.opening_qty || 0);
      const cId = String(item.id);
      const prodStats = statsByChallan[cId] || { totalActual: 0, extraInput: 0 };
      const totalInput = openingQty + prodStats.extraInput;
      const totalActual = prodStats.totalActual;

      let remainingBalance = Math.max(0, totalInput - totalActual);
      let completionRate = totalInput > 0 ? Math.min(100, Math.round((totalActual / totalInput) * 100)) : 0;

      if (meta.status === 'Complete') {
        remainingBalance = 0;
        completionRate = 100;
      }

      return {
        id: cId,
        dcNo: String(item.dc_no),
        party: String(item.party || ''),
        article: String(item.article || ''),
        item: meta.itemVal,
        openingQty,
        orderDate: String(item.open_date || item.order_date || ''),
        firstExpectedDate: meta.firstExpectedDate,
        dailyExpectedRate: meta.dailyExpectedRate,
        notes: cleanRemarks(item.remarks || item.notes),
        status: meta.status,
        totalActualOutput: totalActual,
        remainingBalance,
        completionRate,
        createdBy: String(item.created_by_id || item.created_by || 'usr-admin-1'),
        createdAt: String(item.created_at || ''),
        updatedAt: String(item.updated_at || ''),
      };
    });

    return NextResponse.json({ success: true, data: challans });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('GET /api/challans error (handling gracefully):', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg, data: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const cleanItem = item ? String(item).trim() : undefined;
    const cleanFirstExpectedDate = firstExpectedDate ? String(firstExpectedDate).trim() : undefined;
    const cleanDailyExpectedRate =
      dailyExpectedRate !== undefined && dailyExpectedRate !== null && Number(dailyExpectedRate) > 0
        ? Number(dailyExpectedRate)
        : undefined;

    // Build tagged remarks string for fallback compatibility
    const metaTags = [
      cleanStatus !== 'Process' ? `[STITCHING:${cleanStatus}]` : '',
      cleanItem ? `[ITEM:${cleanItem}]` : '',
      cleanFirstExpectedDate ? `[EXPECTED_START:${cleanFirstExpectedDate}]` : '',
      cleanDailyExpectedRate ? `[EXPECTED_RATE:${cleanDailyExpectedRate}]` : '',
    ].filter(Boolean).join(' ');

    const combinedRemarks = [metaTags, cleanNotes].filter(Boolean).join(' ').trim();

    // Primary attempt: try writing direct columns (item, first_expected_date, daily_expected_rate)
    let payload: Record<string, unknown> = {
      id: newId,
      dc_no: String(dcNo).trim().toUpperCase(),
      party: String(party).trim(),
      article: article ? String(article).trim() : 'Garment Batch',
      item: cleanItem || null,
      opening_qty: Number(openingQty),
      open_date: orderDate || new Date().toISOString().split('T')[0],
      first_expected_date: cleanFirstExpectedDate || null,
      daily_expected_rate: cleanDailyExpectedRate || null,
      remarks: cleanNotes || null,
      status: cleanStatus,
      created_by_id: 'usr-admin-1',
    };

    let { data, error } = await supabaseAdmin
      .from('challans')
      .insert(payload)
      .select()
      .single();

    // If error because new columns or check constraint do not exist in database yet:
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

        // Fall back to legacy columns with tagged remarks
        payload = {
          id: newId,
          dc_no: String(dcNo).trim().toUpperCase(),
          party: String(party).trim(),
          article: article ? String(article).trim() : 'Garment Batch',
          opening_qty: Number(openingQty),
          open_date: orderDate || new Date().toISOString().split('T')[0],
          remarks: combinedRemarks || null,
          status: fallbackStatus,
          created_by_id: 'usr-admin-1',
        };

        const retry = await supabaseAdmin
          .from('challans')
          .insert(payload)
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

    const createdChallan = {
      id: String(data.id),
      dcNo: String(data.dc_no),
      party: String(data.party),
      article: String(data.article || ''),
      item: cleanItem,
      openingQty: Number(data.opening_qty),
      orderDate: String(data.open_date || data.order_date || ''),
      firstExpectedDate: cleanFirstExpectedDate,
      dailyExpectedRate: cleanDailyExpectedRate,
      notes: cleanRemarks(data.remarks),
      status: cleanStatus,
      totalActualOutput: 0,
      remainingBalance: Number(data.opening_qty),
      completionRate: 0,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };

    return NextResponse.json({ success: true, data: createdChallan });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
