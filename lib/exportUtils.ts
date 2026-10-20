import ExcelJS from 'exceljs';
import { Challan, PlanningRow, PlanningTotals, StitchingStatus } from '@/types';
import { FULL_MONTH_NAMES } from './storage';

interface ExportRegisterOptions {
  challan: Challan;
  rows: PlanningRow[];
  totals: PlanningTotals;
  monthName: string;
  year: number;
  scope?: 'current_month' | 'all_dates';
  userName?: string;
}

/**
 * Generate a beautifully styled, executive-grade Microsoft Excel (.xlsx) workbook using ExcelJS
 * Features:
 * - Brand Banner with high-contrast navy header
 * - Structured Master DC Meta Card with no text truncation
 * - Visual KPI Metric Cards with background badges
 * - Full data table with zebra striping, Sunday highlights, and thin grid borders
 * - Number formatting with comma separators (#,##0)
 * - Dynamic color highlights for Difference (Green = ahead, Red = shortfall)
 * - Distinctive Status badges (Complete, Inline, Process)
 * - Accounting standard Totals row with double bottom borders
 * - Manager & QA Inspector Signature authorization blocks
 */
export async function exportRegisterToExcel({
  challan,
  rows,
  totals,
  monthName,
  year,
  scope = 'current_month',
  userName = 'Production Supervisor',
}: ExportRegisterOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EYE Planning Software - Denim Crafts';
  workbook.lastModifiedBy = userName;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Filter rows based on scope
  const targetRows =
    scope === 'current_month'
      ? rows.filter((r) => r.year === year)
      : [...rows].sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

  const sheetTitle = `DC_${challan.dcNo}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const worksheet = workbook.addWorksheet(sheetTitle, {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // Color Palette (Hex ARGB format for ExcelJS)
  const NAVY_DARK = 'FF0F172A';     // Slate 900
  const NAVY_MEDIUM = 'FF1E293B';   // Slate 800
  const BLUE_ACCENT = 'FF0284C7';   // Sky 600
  const GRAY_LIGHT = 'FFF8FAFC';    // Slate 50
  const GRAY_ROW_ALT = 'FFF1F5F9';  // Slate 100
  const BORDER_COLOR = 'FFCBD5E1';  // Slate 300
  const TEXT_DARK = 'FF0F172A';
  const TEXT_MUTED = 'FF64748B';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };

  // 1. TOP HEADER BANNER (Row 1 to 2)
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'DENIM CRAFTS — APPAREL MANUFACTURING & PRODUCTION REGISTER';
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells('A2:K2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `DELIVERY CHALLAN RECORD & DATE-WISE STITCHING PROGRESS • DC #${challan.dcNo}`;
  subtitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF94A3B8' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_MEDIUM } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // Spacer row 3
  worksheet.getRow(3).height = 8;

  // 2. MASTER METADATA CARDS (Rows 4 & 5)
  // Row 4: DC Details
  const metaLabels = [
    { cell: 'A4', label: 'DC Number:', valCell: 'B4', val: `DC #${challan.dcNo}`, boldVal: true },
    { cell: 'C4', label: 'Line / Assembly:', valCell: 'D4', val: challan.party, boldVal: true },
    { cell: 'E4', label: 'Article / Style:', valCell: 'F4', val: challan.article || 'Standard', boldVal: false },
    { cell: 'G4', label: 'Opening Qty:', valCell: 'H4', val: challan.openingQty, numFmt: '#,##0', boldVal: true },
    { cell: 'I4', label: 'Status:', valCell: 'J4', val: challan.status, boldVal: true, statusColor: true },
  ];

  metaLabels.forEach((item) => {
    const lCell = worksheet.getCell(item.cell);
    lCell.value = item.label;
    lCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_MUTED } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_LIGHT } };
    lCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const vCell = worksheet.getCell(item.valCell);
    vCell.value = item.val;
    vCell.font = { name: 'Calibri', size: 10, bold: item.boldVal, color: { argb: TEXT_DARK } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_LIGHT } };
    vCell.alignment = { vertical: 'middle', horizontal: 'left' };
    if (item.numFmt) vCell.numFmt = item.numFmt;

    if (item.statusColor) {
      if (item.val === 'Complete') {
        vCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      } else if (item.val === 'Inline') {
        vCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      } else {
        vCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB45309' } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      }
    }
  });
  worksheet.getRow(4).height = 22;

  // Row 5: Dates and Generated By
  const metaRow2 = [
    { cell: 'A5', label: 'Order Date:', valCell: 'B5', val: challan.orderDate },
    { cell: 'C5', label: 'Report Scope:', valCell: 'D5', val: scope === 'all_dates' ? 'Full Order Register' : `${monthName} ${year}` },
    { cell: 'E5', label: 'Generated By:', valCell: 'F5', val: userName },
    { cell: 'G5', label: 'Export Date:', valCell: 'H5', val: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
    { cell: 'I5', label: 'Total Days:', valCell: 'J5', val: `${targetRows.length} Days` },
  ];

  metaRow2.forEach((item) => {
    const lCell = worksheet.getCell(item.cell);
    lCell.value = item.label;
    lCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_MUTED } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_LIGHT } };
    lCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const vCell = worksheet.getCell(item.valCell);
    vCell.value = item.val;
    vCell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: TEXT_DARK } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_LIGHT } };
    vCell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  worksheet.getRow(5).height = 20;

  // Apply border to metadata card
  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4',
   'A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5'].forEach((c) => {
    worksheet.getCell(c).border = thinBorder;
  });

  // Spacer row 6
  worksheet.getRow(6).height = 10;

  // 3. EXECUTIVE KPI METRICS BAR (Row 7)
  const kpiData = [
    { range: 'A7:B7', label: 'OPENING QTY', val: challan.openingQty, color: 'FF334155' },
    { range: 'C7:D7', label: 'TOTAL INPUT', val: totals.targetInput, color: 'FF0369A1' },
    { range: 'E7:F7', label: 'EXPECTED QUOTA', val: totals.totalExpectedOutput, color: 'FF4338CA' },
    { range: 'G7:H7', label: 'ACTUAL OUTPUT', val: totals.totalActualOutput, color: 'FF15803D' },
    { range: 'I7:I7', label: 'NET VARIANCE', val: totals.netDifference, color: totals.netDifference >= 0 ? 'FF15803D' : 'FFBE123C', isDiff: true },
    { range: 'J7:K7', label: 'CURRENT BALANCE', val: totals.currentBalance, color: 'FF0F172A' },
  ];

  kpiData.forEach((kpi) => {
    worksheet.mergeCells(kpi.range);
    const startCell = worksheet.getCell(kpi.range.split(':')[0]);
    const formattedVal = kpi.isDiff && kpi.val > 0 ? `+${kpi.val.toLocaleString()}` : kpi.val.toLocaleString();
    startCell.value = `${kpi.label}\n${formattedVal} Pcs`;
    startCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: kpi.color } };
    startCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_ROW_ALT } };
    startCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    startCell.border = thinBorder;
  });
  worksheet.getRow(7).height = 36;

  // Spacer row 8
  worksheet.getRow(8).height = 10;

  // 4. MAIN DATA TABLE HEADER (Row 9)
  const tableHeaders = [
    { col: 'A', text: 'Date', width: 14, align: 'center' },
    { col: 'B', text: 'Day', width: 10, align: 'center' },
    { col: 'C', text: 'DC #', width: 12, align: 'center' },
    { col: 'D', text: 'Initial Qty', width: 15, align: 'right' },
    { col: 'E', text: 'Input (Pcs)', width: 15, align: 'right' },
    { col: 'F', text: 'Days Gap', width: 12, align: 'center' },
    { col: 'G', text: 'Expected Output', width: 18, align: 'right' },
    { col: 'H', text: 'Actual Output', width: 18, align: 'right' },
    { col: 'I', text: 'Diff (Actual - Exp)', width: 20, align: 'right' },
    { col: 'J', text: 'Balance (Pcs)', width: 16, align: 'right' },
    { col: 'K', text: 'Status', width: 15, align: 'center' },
  ];

  tableHeaders.forEach((th) => {
    const cell = worksheet.getCell(`${th.col}9`);
    cell.value = th.text;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
    cell.alignment = { vertical: 'middle', horizontal: th.align as any, wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: NAVY_DARK } },
      bottom: { style: 'medium', color: { argb: NAVY_DARK } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });
  worksheet.getRow(9).height = 26;

  // 5. DATA ROWS
  let currentRowNum = 10;

  targetRows.forEach((row, index) => {
    const isFirstRow = index === 0;
    const dateObj = new Date(row.dateStr);
    const dayOfWeek = isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const isSunday = dayOfWeek === 'Sun';

    const hasActual = row.actualOutput !== null && row.actualOutput !== undefined;
    const hasExpected = row.expectedOutput !== null && row.expectedOutput !== undefined;
    const diff = (row.actualOutput || 0) - (row.expectedOutput || 0);

    const isZebra = index % 2 === 1;
    let baseRowFill = isZebra ? GRAY_ROW_ALT : 'FFFFFFFF';
    if (isSunday) baseRowFill = 'FFFFF1F2'; // Soft rose for weekend/Sunday

    const rowObj = worksheet.getRow(currentRowNum);
    rowObj.height = 20;

    // A: Date
    const cellA = worksheet.getCell(`A${currentRowNum}`);
    cellA.value = row.dayLabel || row.dateStr;
    cellA.alignment = { vertical: 'middle', horizontal: 'center' };
    cellA.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_DARK } };

    // B: Day
    const cellB = worksheet.getCell(`B${currentRowNum}`);
    cellB.value = dayOfWeek;
    cellB.alignment = { vertical: 'middle', horizontal: 'center' };
    cellB.font = {
      name: 'Calibri',
      size: 9,
      bold: isSunday,
      color: { argb: isSunday ? 'FFBE123C' : TEXT_MUTED },
    };

    // C: DC #
    const cellC = worksheet.getCell(`C${currentRowNum}`);
    cellC.value = isFirstRow ? challan.dcNo : '';
    cellC.alignment = { vertical: 'middle', horizontal: 'center' };
    cellC.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_DARK } };

    // D: Initial Qty
    const cellD = worksheet.getCell(`D${currentRowNum}`);
    cellD.value = isFirstRow ? challan.openingQty : '';
    cellD.alignment = { vertical: 'middle', horizontal: 'right' };
    cellD.font = { name: 'Calibri', size: 9, color: { argb: TEXT_MUTED } };
    if (isFirstRow) cellD.numFmt = '#,##0';

    // E: Input
    const cellE = worksheet.getCell(`E${currentRowNum}`);
    if (row.inputQty !== null && row.inputQty !== undefined && Number(row.inputQty) > 0) {
      cellE.value = Number(row.inputQty);
      cellE.numFmt = '#,##0';
      cellE.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0369A1' } };
    } else {
      cellE.value = '';
    }
    cellE.alignment = { vertical: 'middle', horizontal: 'right' };

    // F: Days Gap
    const cellF = worksheet.getCell(`F${currentRowNum}`);
    cellF.value = row.daysGap ? `${row.daysGap}d` : '-';
    cellF.alignment = { vertical: 'middle', horizontal: 'center' };
    cellF.font = { name: 'Calibri', size: 9, color: { argb: TEXT_MUTED } };

    // G: Expected Output
    const cellG = worksheet.getCell(`G${currentRowNum}`);
    if (row.expectedOutput !== null && row.expectedOutput !== undefined && Number(row.expectedOutput) > 0) {
      cellG.value = Number(row.expectedOutput);
      cellG.numFmt = '#,##0';
      cellG.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF4338CA' } };
    } else {
      cellG.value = '';
    }
    cellG.alignment = { vertical: 'middle', horizontal: 'right' };

    // H: Actual Output
    const cellH = worksheet.getCell(`H${currentRowNum}`);
    if (row.actualOutput !== null && row.actualOutput !== undefined && Number(row.actualOutput) > 0) {
      cellH.value = Number(row.actualOutput);
      cellH.numFmt = '#,##0';
      cellH.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF15803D' } };
    } else {
      cellH.value = '';
    }
    cellH.alignment = { vertical: 'middle', horizontal: 'right' };

    // I: Diff (Actual - Exp)
    const cellI = worksheet.getCell(`I${currentRowNum}`);
    if (hasActual || hasExpected) {
      cellI.value = diff;
      cellI.numFmt = diff > 0 ? '+#,##0;-#,##0;0' : '#,##0';
      cellI.alignment = { vertical: 'middle', horizontal: 'right' };
      if (diff > 0) {
        cellI.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF15803D' } };
        cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      } else if (diff < 0) {
        cellI.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
        cellI.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else {
        cellI.font = { name: 'Calibri', size: 9, color: { argb: TEXT_MUTED } };
      }
    } else {
      cellI.value = 0;
      cellI.font = { name: 'Calibri', size: 9, color: { argb: TEXT_MUTED } };
      cellI.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // J: Balance
    const cellJ = worksheet.getCell(`J${currentRowNum}`);
    cellJ.value = Number(row.balance || 0);
    cellJ.numFmt = '#,##0';
    cellJ.alignment = { vertical: 'middle', horizontal: 'right' };
    cellJ.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_DARK } };
    if (row.balance === 0) {
      cellJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    }

    // K: Status
    const cellK = worksheet.getCell(`K${currentRowNum}`);
    const st = row.status || 'Process';
    cellK.value = st;
    cellK.alignment = { vertical: 'middle', horizontal: 'center' };
    if (st === 'Complete') {
      cellK.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF15803D' } };
      cellK.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    } else if (st === 'Inline') {
      cellK.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
      cellK.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    } else {
      cellK.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
      cellK.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }

    // Apply baseline background and borders to cells that don't have custom fills
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'].forEach((colLetter) => {
      const c = worksheet.getCell(`${colLetter}${currentRowNum}`);
      if (!c.fill) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseRowFill } };
      }
      c.border = thinBorder;
    });
    worksheet.getCell(`I${currentRowNum}`).border = thinBorder;
    worksheet.getCell(`K${currentRowNum}`).border = thinBorder;

    currentRowNum++;
  });

  // 6. TOTALS & BALANCES ROW
  const totalsRowNum = currentRowNum;
  worksheet.mergeCells(`A${totalsRowNum}:C${totalsRowNum}`);
  const totLabel = worksheet.getCell(`A${totalsRowNum}`);
  totLabel.value = 'TOTALS & BALANCES';
  totLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  // Initial Qty Total
  const totD = worksheet.getCell(`D${totalsRowNum}`);
  totD.value = challan.openingQty;
  totD.numFmt = '#,##0';
  totD.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totD.alignment = { vertical: 'middle', horizontal: 'right' };

  // Target Input Total
  const totE = worksheet.getCell(`E${totalsRowNum}`);
  totE.value = totals.targetInput;
  totE.numFmt = '#,##0';
  totE.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totE.alignment = { vertical: 'middle', horizontal: 'right' };

  // Gap spacer
  const totF = worksheet.getCell(`F${totalsRowNum}`);
  totF.value = '-';
  totF.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF94A3B8' } };
  totF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totF.alignment = { vertical: 'middle', horizontal: 'center' };

  // Expected Output Total
  const totG = worksheet.getCell(`G${totalsRowNum}`);
  totG.value = totals.totalExpectedOutput;
  totG.numFmt = '#,##0';
  totG.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totG.alignment = { vertical: 'middle', horizontal: 'right' };

  // Actual Output Total
  const totH = worksheet.getCell(`H${totalsRowNum}`);
  totH.value = totals.totalActualOutput;
  totH.numFmt = '#,##0';
  totH.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totH.alignment = { vertical: 'middle', horizontal: 'right' };

  // Net Difference Total
  const totI = worksheet.getCell(`I${totalsRowNum}`);
  totI.value = totals.netDifference;
  totI.numFmt = totals.netDifference > 0 ? '+#,##0;-#,##0;0' : '#,##0';
  totI.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totI.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: totals.netDifference >= 0 ? 'FF166534' : 'FF991B1B' },
  };
  totI.alignment = { vertical: 'middle', horizontal: 'right' };

  // Final Balance Total
  const totJ = worksheet.getCell(`J${totalsRowNum}`);
  totJ.value = totals.currentBalance;
  totJ.numFmt = '#,##0';
  totJ.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totJ.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totJ.alignment = { vertical: 'middle', horizontal: 'right' };

  // Status
  const totK = worksheet.getCell(`K${totalsRowNum}`);
  totK.value = challan.status;
  totK.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totK.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  totK.alignment = { vertical: 'middle', horizontal: 'center' };

  // Accounting double border for totals row
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach((colLetter) => {
    worksheet.getCell(`${colLetter}${totalsRowNum}`).border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'double', color: { argb: NAVY_DARK } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });
  worksheet.getRow(totalsRowNum).height = 24;

  // 7. STRUCTURED KPI SUMMARY & AUDIT SECTION (Below table)
  let kpiStartRow = totalsRowNum + 2;
  worksheet.getRow(kpiStartRow - 1).height = 10;

  worksheet.mergeCells(`A${kpiStartRow}:F${kpiStartRow}`);
  const kpiTitle = worksheet.getCell(`A${kpiStartRow}`);
  kpiTitle.value = 'OFFICIAL PRODUCTION KPI SUMMARY & AUDIT METRICS';
  kpiTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY_DARK } };
  kpiTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_ROW_ALT } };
  kpiTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(kpiStartRow).height = 24;

  const summaryItems = [
    { label: 'Initial Target Opening Lot Size', val: challan.openingQty, unit: 'Pieces', numFmt: '#,##0' },
    { label: 'Total Production Input Supplied', val: totals.targetInput, unit: 'Pieces', numFmt: '#,##0' },
    { label: 'Cumulative Expected Quota', val: totals.totalExpectedOutput, unit: 'Pieces', numFmt: '#,##0' },
    { label: 'Cumulative Actual Stitching Output', val: totals.totalActualOutput, unit: 'Pieces', numFmt: '#,##0' },
    {
      label: 'Net Variance (Actual vs Quota)',
      val: totals.netDifference,
      unit: totals.netDifference >= 0 ? 'Ahead of Quota' : 'Production Shortfall',
      numFmt: totals.netDifference > 0 ? '+#,##0' : '#,##0',
      highlight: totals.netDifference >= 0 ? 'green' : 'red',
    },
    { label: 'Remaining Unstitched Balance', val: totals.currentBalance, unit: 'Pieces', numFmt: '#,##0' },
    { label: 'Overall Completion Rate', val: `${totals.completionRate}%`, unit: challan.status },
    { label: 'Average Daily Output Produced', val: totals.averageDailyOutput, unit: 'Pieces / Active Day', numFmt: '#,##0' },
  ];

  summaryItems.forEach((item, idx) => {
    const rNum = kpiStartRow + 1 + idx;
    worksheet.mergeCells(`A${rNum}:C${rNum}`);
    const lCell = worksheet.getCell(`A${rNum}`);
    lCell.value = item.label;
    lCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_DARK } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : GRAY_LIGHT } };
    lCell.alignment = { vertical: 'middle', horizontal: 'left' };
    lCell.border = thinBorder;

    const vCell = worksheet.getCell(`D${rNum}`);
    vCell.value = item.val;
    vCell.font = {
      name: 'Calibri',
      size: 9,
      bold: true,
      color: {
        argb: item.highlight === 'green' ? 'FF15803D' : item.highlight === 'red' ? 'FFB91C1C' : TEXT_DARK,
      },
    };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : GRAY_LIGHT } };
    vCell.alignment = { vertical: 'middle', horizontal: 'right' };
    if (item.numFmt) vCell.numFmt = item.numFmt;
    vCell.border = thinBorder;

    worksheet.mergeCells(`E${rNum}:F${rNum}`);
    const uCell = worksheet.getCell(`E${rNum}`);
    uCell.value = item.unit;
    uCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: TEXT_MUTED } };
    uCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : GRAY_LIGHT } };
    uCell.alignment = { vertical: 'middle', horizontal: 'left' };
    uCell.border = thinBorder;

    worksheet.getRow(rNum).height = 18;
  });

  // 8. SIGNATURE & AUTHORIZATION BLOCKS
  const sigStartRow = kpiStartRow + summaryItems.length + 3;
  worksheet.mergeCells(`A${sigStartRow}:B${sigStartRow}`);
  worksheet.mergeCells(`D${sigStartRow}:E${sigStartRow}`);
  worksheet.mergeCells(`G${sigStartRow}:H${sigStartRow}`);
  worksheet.mergeCells(`J${sigStartRow}:K${sigStartRow}`);

  const sigBoxes = [
    { cell: `A${sigStartRow}`, title: 'PREPARED BY', sub: 'Data Entry Operator' },
    { cell: `D${sigStartRow}`, title: 'LINE SUPERVISOR', sub: challan.party },
    { cell: `G${sigStartRow}`, title: 'QA INSPECTOR', sub: 'Quality Control Department' },
    { cell: `J${sigStartRow}`, title: 'PRODUCTION MANAGER', sub: 'Authorized Approval' },
  ];

  sigBoxes.forEach((sig) => {
    const c = worksheet.getCell(sig.cell);
    c.value = `___________________________\n${sig.title}\n(${sig.sub})`;
    c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEXT_DARK } };
    c.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
  });
  worksheet.getRow(sigStartRow).height = 50;

  // 9. COLUMN WIDTHS CONFIGURATION (Ensures NO truncated text anywhere!)
  const colWidths = [
    16, // A: Date / Label
    12, // B: Day
    14, // C: DC #
    18, // D: Initial Qty
    16, // E: Input (Pcs)
    14, // F: Days Gap
    20, // G: Expected Output
    20, // H: Actual Output
    24, // I: Diff (Actual - Exp)
    18, // J: Balance (Pcs)
    16, // K: Status
  ];

  colWidths.forEach((w, idx) => {
    worksheet.getColumn(idx + 1).width = w;
  });

  // 10. WRITE FILE TO BROWSER DOWNLOAD
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const cleanParty = (challan.party || 'Assembly').replace(/[^a-zA-Z0-9_-]/g, '_');
  const scopeLabel = scope === 'all_dates' ? 'Full_Register' : `${monthName}_${year}`;
  const fileName = `DC_${challan.dcNo}_${cleanParty}_${scopeLabel}_Official.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Master Delivery Challan Summary List to Excel (.xlsx) with professional styling
 */
export async function exportChallansToExcel(challans: Challan[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EYE Planning Software - Denim Crafts';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('DC_Directory', {
    views: [{ showGridLines: true }],
  });

  // Colors
  const NAVY_DARK = 'FF0F172A';
  const NAVY_MEDIUM = 'FF1E293B';
  const GRAY_ROW_ALT = 'FFF1F5F9';
  const BORDER_COLOR = 'FFCBD5E1';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };

  // Title
  worksheet.mergeCells('A1:G1');
  const title = worksheet.getCell('A1');
  title.value = 'DENIM CRAFTS — DELIVERY CHALLANS MASTER DIRECTORY';
  title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells('A2:G2');
  const subtitle = worksheet.getCell('A2');
  subtitle.value = `Exported: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • Total Records: ${challans.length}`;
  subtitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF94A3B8' } };
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_MEDIUM } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // Table Headers
  const headers = [
    { col: 'A', text: 'DC Number', width: 16 },
    { col: 'B', text: 'Line or Assembly', width: 32 },
    { col: 'C', text: 'Article / Style', width: 24 },
    { col: 'D', text: 'Opening Qty (Pcs)', width: 18 },
    { col: 'E', text: 'Order Date', width: 16 },
    { col: 'F', text: 'Status', width: 16 },
    { col: 'G', text: 'Notes', width: 32 },
  ];

  headers.forEach((h) => {
    const c = worksheet.getCell(`${h.col}4`);
    c.value = h.text;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
    c.alignment = { vertical: 'middle', horizontal: h.col === 'D' ? 'right' : 'left' };
    c.border = thinBorder;
  });
  worksheet.getRow(4).height = 24;

  let rIdx = 5;
  challans.forEach((c, idx) => {
    const isZebra = idx % 2 === 1;
    const fill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: isZebra ? GRAY_ROW_ALT : 'FFFFFFFF' },
    };

    const cellA = worksheet.getCell(`A${rIdx}`);
    cellA.value = `DC #${c.dcNo}`;
    cellA.font = { name: 'Calibri', size: 9, bold: true };
    cellA.fill = fill;
    cellA.border = thinBorder;

    const cellB = worksheet.getCell(`B${rIdx}`);
    cellB.value = c.party;
    cellB.font = { name: 'Calibri', size: 9, bold: true };
    cellB.fill = fill;
    cellB.border = thinBorder;

    const cellC = worksheet.getCell(`C${rIdx}`);
    cellC.value = c.article || '-';
    cellC.font = { name: 'Calibri', size: 9 };
    cellC.fill = fill;
    cellC.border = thinBorder;

    const cellD = worksheet.getCell(`D${rIdx}`);
    cellD.value = c.openingQty;
    cellD.numFmt = '#,##0';
    cellD.font = { name: 'Calibri', size: 9, bold: true };
    cellD.alignment = { horizontal: 'right' };
    cellD.fill = fill;
    cellD.border = thinBorder;

    const cellE = worksheet.getCell(`E${rIdx}`);
    cellE.value = c.orderDate;
    cellE.font = { name: 'Calibri', size: 9 };
    cellE.fill = fill;
    cellE.border = thinBorder;

    const cellF = worksheet.getCell(`F${rIdx}`);
    cellF.value = c.status;
    cellF.alignment = { horizontal: 'center' };
    cellF.font = { name: 'Calibri', size: 9, bold: true };
    if (c.status === 'Complete') {
      cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      cellF.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF15803D' } };
    } else if (c.status === 'Inline') {
      cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cellF.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
    } else {
      cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cellF.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB45309' } };
    }
    cellF.border = thinBorder;

    const cellG = worksheet.getCell(`G${rIdx}`);
    cellG.value = c.notes || '';
    cellG.font = { name: 'Calibri', size: 9, italic: true };
    cellG.fill = fill;
    cellG.border = thinBorder;

    worksheet.getRow(rIdx).height = 20;
    rIdx++;
  });

  headers.forEach((h, idx) => {
    worksheet.getColumn(idx + 1).width = h.width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Delivery_Challans_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Date-Wise Production Register Sheet to CSV format
 */
export function exportRegisterToCSV({
  challan,
  rows,
  totals,
  monthName,
  year,
  scope = 'current_month',
}: ExportRegisterOptions) {
  const targetRows =
    scope === 'current_month'
      ? rows.filter((r) => r.year === year)
      : [...rows].sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

  const lines: string[] = [];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  lines.push(escapeCSV(`PRODUCTION REGISTER - DC #${challan.dcNo} (${challan.party})`));
  lines.push(
    [
      escapeCSV('DC Number:'),
      escapeCSV(`DC #${challan.dcNo}`),
      escapeCSV('Line or Assembly:'),
      escapeCSV(challan.party),
      escapeCSV('Article:'),
      escapeCSV(challan.article || 'Standard'),
    ].join(',')
  );
  lines.push(
    [
      escapeCSV('Opening Qty:'),
      escapeCSV(challan.openingQty),
      escapeCSV('Order Date:'),
      escapeCSV(challan.orderDate),
      escapeCSV('Scope:'),
      escapeCSV(scope === 'all_dates' ? 'All Dates' : `${monthName} ${year}`),
    ].join(',')
  );
  lines.push('');

  lines.push(
    [
      'Date',
      'Day',
      'DC #',
      'Opening Qty',
      'Input (Pcs)',
      'Days Gap',
      'Expected Output',
      'Actual Output',
      'Diff (Actual - Exp)',
      'Balance (Pcs)',
      'Status',
    ]
      .map(escapeCSV)
      .join(',')
  );

  targetRows.forEach((row, index) => {
    const isFirstRow = index === 0;
    const dateObj = new Date(row.dateStr);
    const dayOfWeek = isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    const hasActual = row.actualOutput !== null && row.actualOutput !== undefined;
    const hasExpected = row.expectedOutput !== null && row.expectedOutput !== undefined;
    const diff = (row.actualOutput || 0) - (row.expectedOutput || 0);

    lines.push(
      [
        escapeCSV(row.dayLabel || row.dateStr),
        escapeCSV(dayOfWeek),
        escapeCSV(isFirstRow ? challan.dcNo : ''),
        escapeCSV(isFirstRow ? challan.openingQty : ''),
        escapeCSV(row.inputQty !== null && row.inputQty !== undefined ? row.inputQty : ''),
        escapeCSV(row.daysGap ? `${row.daysGap}d` : ''),
        escapeCSV(row.expectedOutput !== null && row.expectedOutput !== undefined ? row.expectedOutput : ''),
        escapeCSV(row.actualOutput !== null && row.actualOutput !== undefined ? row.actualOutput : ''),
        escapeCSV(hasActual || hasExpected ? (diff > 0 ? `+${diff}` : diff) : 0),
        escapeCSV(row.balance || 0),
        escapeCSV(row.status || 'Process'),
      ].join(',')
    );
  });

  lines.push(
    [
      escapeCSV('TOTALS & BALANCES'),
      '',
      '',
      escapeCSV(challan.openingQty),
      escapeCSV(totals.targetInput),
      '',
      escapeCSV(totals.totalExpectedOutput),
      escapeCSV(totals.totalActualOutput),
      escapeCSV(totals.netDifference > 0 ? `+${totals.netDifference}` : totals.netDifference),
      escapeCSV(totals.currentBalance),
      escapeCSV(challan.status),
    ].join(',')
  );

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanParty = (challan.party || 'Assembly').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `DC_${challan.dcNo}_${cleanParty}_Register.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
