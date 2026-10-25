import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const challanId = searchParams.get('challanId');
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    if (!challanId) {
      return NextResponse.json({ success: false, error: 'challanId is required.' }, { status: 400 });
    }

    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    const month = monthStr ? parseInt(monthStr, 10) : new Date().getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Fetch entries from Supabase entries table
    const { data: entries, error } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('challan_id', challanId);

    if (error) {
      console.error('Supabase GET entries error:', error);
      return NextResponse.json({ success: false, error: error.message, data: {} }, { status: 200 });
    }

    // 2. Map entries by dateStr
    const entriesByDate: Record<
      string,
      {
        inputQty?: number | null;
        actualOutput?: number | null;
        expectedOutput?: number | null;
        status?: 'Process' | 'Inline' | 'Complete';
        notes?: string;
      }
    > = {};

    (entries || []).forEach((e: Record<string, unknown>) => {
      // Normalize date string (strip any timezone or timestamp suffix)
      const rawDate = String(e.entry_date || '');
      const dateStr = rawDate.split('T')[0];
      if (!dateStr) return;

      if (!entriesByDate[dateStr]) {
        entriesByDate[dateStr] = {};
      }
      const qty = Number(e.qty || 0);
      const type = String(e.type || '').toUpperCase();
      const note = e.note ? String(e.note) : '';

      if (type === 'IN') {
        entriesByDate[dateStr].inputQty = (entriesByDate[dateStr].inputQty || 0) + qty;
        if (note && !entriesByDate[dateStr].notes) {
          entriesByDate[dateStr].notes = note;
        }
      } else if (type === 'OUT') {
        // Parse metadata tags from note
        const isNoActual = note.includes('NO_ACTUAL:1') || note.includes('ACTUAL:NONE');
        const actualMatch = note.match(/ACTUAL:(-?\d+)/i);
        const expMatch = note.match(/EXP:(\d+)/i);
        const statusMatch = note.match(/STATUS:(Process|Inline|Complete)/i);
        const noteMatch = note.match(/NOTE:([^;]+)/i);

        if (isNoActual) {
          entriesByDate[dateStr].actualOutput = null;
        } else if (actualMatch) {
          entriesByDate[dateStr].actualOutput = Number(actualMatch[1]);
        } else if (qty > 0) {
          entriesByDate[dateStr].actualOutput = qty;
        }

        if (expMatch) {
          entriesByDate[dateStr].expectedOutput = Number(expMatch[1]);
        }

        if (statusMatch) {
          const s = statusMatch[1].toLowerCase();
          entriesByDate[dateStr].status =
            s === 'complete' ? 'Complete' : s === 'inline' ? 'Inline' : 'Process';
        }

        if (noteMatch) {
          entriesByDate[dateStr].notes = noteMatch[1].trim();
        } else {
          // Clean legacy notes
          const cleanNote = note
            .replace(/STATUS:[^;]+;?/gi, '')
            .replace(/EXP:\d*;?/gi, '')
            .replace(/NO_ACTUAL:[^;]+;?/gi, '')
            .replace(/ACTUAL:[^;]+;?/gi, '')
            .replace(/NOTE:/gi, '')
            .trim();
          if (cleanNote) {
            entriesByDate[dateStr].notes = cleanNote;
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: entriesByDate,
      allDates: Object.keys(entriesByDate),
      totalEntries: entries?.length || 0,
      daysInMonth,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in GET /api/planning:', err);
    return NextResponse.json({ success: false, error: errorMsg, data: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { challanId, rows, userId } = body;

    if (!challanId || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'challanId and rows array are required.' }, { status: 400 });
    }

    const createdBy = userId || 'usr-admin-primary';

    // 1. Consolidate and merge rows by normalized dateStr (YYYY-MM-DD)
    const consolidatedByDate = new Map<
      string,
      {
        inputQty?: number | null;
        actualOutput?: number | null;
        expectedOutput?: number | null;
        status?: string;
        buyerNotes?: string | null;
      }
    >();

    rows.forEach((r: Record<string, unknown>) => {
      const rawDate = String(r.dateStr || '').trim();
      const dateStr = rawDate.split('T')[0];
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

      const existing = consolidatedByDate.get(dateStr) || {};

      let inputVal: number | null = null;
      if (r.inputQty !== null && r.inputQty !== undefined && String(r.inputQty).trim() !== '') {
        const parsed = Number(r.inputQty);
        inputVal = isNaN(parsed) ? null : parsed;
      }

      let actualVal: number | null = null;
      if (r.actualOutput !== null && r.actualOutput !== undefined && String(r.actualOutput).trim() !== '') {
        const parsed = Number(r.actualOutput);
        actualVal = isNaN(parsed) ? null : parsed;
      }

      let expVal: number | null = null;
      if (r.expectedOutput !== null && r.expectedOutput !== undefined && String(r.expectedOutput).trim() !== '') {
        const parsed = Number(r.expectedOutput);
        expVal = isNaN(parsed) ? null : parsed;
      }

      const statusVal = r.status ? String(r.status) : existing.status ?? 'Process';
      const notesVal = r.buyerNotes ? String(r.buyerNotes) : existing.buyerNotes ?? null;

      consolidatedByDate.set(dateStr, {
        inputQty: inputVal,
        actualOutput: actualVal,
        expectedOutput: expVal,
        status: statusVal,
        buyerNotes: notesVal,
      });
    });

    // 2. Prepare entries to save to Supabase using Map to ensure 100% unique primary keys
    const entryMap = new Map<
      string,
      {
        id: string;
        challan_id: string;
        entry_date: string;
        type: 'IN' | 'OUT';
        qty: number;
        note?: string | null;
        created_by_id: string;
        updated_at: string;
      }
    >();

    consolidatedByDate.forEach((r, dateStr) => {
      // (a) INPUT entry
      if (r.inputQty !== null && r.inputQty !== undefined && r.inputQty > 0) {
        const id = `ent-in-${challanId}-${dateStr}`;
        entryMap.set(id, {
          id,
          challan_id: challanId,
          entry_date: dateStr,
          type: 'IN',
          qty: Math.round(r.inputQty),
          note: r.buyerNotes ? String(r.buyerNotes) : null,
          created_by_id: createdBy,
          updated_at: new Date().toISOString(),
        });
      }

      // (b) ACTUAL OUTPUT & EXPECTED & STATUS entry
      const hasActual = r.actualOutput !== null && r.actualOutput !== undefined;
      const hasExpected = r.expectedOutput !== null && r.expectedOutput !== undefined;
      const hasStatus = Boolean(r.status);
      const hasNotes = Boolean(r.buyerNotes);

      if (hasActual || hasExpected || (hasStatus && r.status !== 'Process') || hasNotes) {
        const actualVal = hasActual ? Number(r.actualOutput) : 0;
        const expVal = hasExpected ? Number(r.expectedOutput) : null;

        const noteParts: string[] = [];
        if (expVal !== null) {
          noteParts.push(`EXP:${expVal}`);
        }
        if (r.status) {
          noteParts.push(`STATUS:${r.status}`);
        }
        if (hasActual) {
          noteParts.push(`ACTUAL:${actualVal}`);
        } else {
          noteParts.push(`NO_ACTUAL:1`);
        }
        if (r.buyerNotes) {
          noteParts.push(`NOTE:${String(r.buyerNotes).replace(/;/g, ' ')}`);
        }
        const noteStr = noteParts.join(';');

        // Supabase entries table has an integer CHECK (qty > 0) constraint
        const qtyToSave = hasActual && actualVal > 0 ? Math.round(actualVal) : 1;
        const id = `ent-out-${challanId}-${dateStr}`;

        entryMap.set(id, {
          id,
          challan_id: challanId,
          entry_date: dateStr,
          type: 'OUT',
          qty: qtyToSave,
          note: noteStr,
          created_by_id: createdBy,
          updated_at: new Date().toISOString(),
        });
      }
    });

    const uniqueEntries = Array.from(entryMap.values());

    // 3. Clear previous entries for this challan in Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('entries')
      .delete()
      .eq('challan_id', challanId);

    if (deleteError) {
      console.warn('Supabase delete previous entries warning:', deleteError);
    }

    // 4. Upsert unique entries (guaranteed unique IDs, immune to entries_pkey collision)
    if (uniqueEntries.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('entries')
        .upsert(uniqueEntries, { onConflict: 'id' });

      if (upsertError) {
        console.error('Supabase upsert entries error:', upsertError);
        return NextResponse.json({ success: false, error: upsertError.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      count: uniqueEntries.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in POST /api/planning:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const challanId = searchParams.get('challanId');

    if (!challanId) {
      return NextResponse.json(
        { success: false, error: 'challanId is required.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('entries')
      .delete()
      .eq('challan_id', challanId);

    if (error) {
      console.error('Supabase DELETE entries error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `All entries for challan ${challanId} deleted successfully.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in DELETE /api/planning:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
