# EYE Planning Software — Denim Crafts

A production planning ledger and Delivery Challan (DC) tracking system built specifically for garment manufacturing, stitching floors, and assembly lines at **Denim Crafts**.

---

## 📋 What Was Accomplished Today

### 1. Renamed to "Line or Assembly"
- Replaced all legacy "Party / Buyer" terminology with **"Line or Assembly"** across the entire application.
- Updated:
  - Delivery Challan Master Hub table header and filter search placeholder (`Search DC #, Line, Assembly, Article...`).
  - Create and Edit Delivery Challan modals.
  - Date-Wise Production Register headers and summary cards.
  - Print / PDF Report previews and authorization signature blocks.
  - Professional Excel (`.xlsx`) and CSV exports.

---

### 2. Live Real-Time Multi-User Updates
- **Instant Synchronization**: Managers, admins, supervisors, and floor operators see live updates whenever an order's actual output, expected quota, input quantity, balance, order date, or stitching status changes.
- **Supabase Real-Time Integration**:
  - Live table subscriptions listening to database changes.
  - Visual status pill indicating active live connection status (`Live Connected`) and last sync timestamp.
  - Manual sync trigger button to force-refresh data on demand.

---

### 3. Date-Wise Production Register & Ledger Engine
- **Automated Mathematical Balance Engine**:
  - Dynamic daily running balance: `Balance = Opening/Carried Balance + Input Qty - Actual Output`.
  - Daily Quota Variance: `Diff = Actual Output - Expected Output` (highlighted in soft green for ahead-of-quota and soft red for shortfall).
  - Status progression workflow per line/day: `Process` ➔ `Inline` ➔ `Complete`.
  - Zero-balance highlighting indicating completed production lots.
- **Multi-Month Continuation**:
  - "Continue Next Month" feature allowing orders that span multiple calendar months to roll forward ending balances into new monthly sheets seamlessly.
  - Month navigation ribbon to switch between production months instantly.

---

### 4. Executive Print & Save as PDF Reports
- **Sheet-Only Printing**:
  - Isolated `@media print` CSS layout specifically targeting the production register.
  - Automatically strips away web application navigation, sidebars, buttons, and chrome during print.
  - Optimized for **A4/Letter Landscape** printing.
- **Factory-Grade Dispatch Report**:
  - Company branding: *Denim Crafts — Garment Assembly & Production Control Department*.
  - Delivery Challan metadata box (DC Number, Line/Assembly, Article/Style, Order Start Date, Opening Qty, Status).
  - Executive 6-metric KPI strip (Target Input, Expected Quota, Actual Output, Net Variance, Closing Balance, Completion Rate).
  - Clean bordered table with day-of-week indicators (Sundays highlighted).
  - Multi-month continuation banners.
  - Four-tier authorization and signature section:
    1. **Prepared By** (Data Operator)
    2. **Line Supervisor** (Line / Assembly)
    3. **QA Inspector** (Quality Assurance)
    4. **Production Manager** (Authorized Sign-Off)
- **Flexible Scope Control**:
  - Choose between printing **Current Month Only** or the **Full Order Register** (all continued dates).

---

### 5. Professional Styled Microsoft Excel (`.xlsx`) Export
- Upgraded export engine using `ExcelJS` to eliminate plain unformatted spreadsheets and truncated text:
  - **Corporate Header Banner**: Deep navy header (`#1E293B`) with white typography.
  - **Structured Metadata Cards**: Multi-column metadata block with light blue/slate accents for DC #, Line / Assembly, Article, Opening Qty, Order Date, and Report Scope.
  - **Executive KPI Scorecard**: Top-level visual metric blocks with soft fills and borders.
  - **Custom Formatted Data Table**:
    - Navy column headers with bold white text.
    - Soft rose highlighting for Sunday rows.
    - Number formatting (`#,##0`) for all piece quantities.
    - Conditional variance fills (soft green for positive variance, soft red for negative).
    - Status badges (*Complete* in green, *Inline* in blue, *Process* in amber).
    - Formal accounting Totals & Balances row with dark styling and double bottom border.
  - **KPI Summary & Audit Block**: Key performance metrics displayed below the table without text clipping.
  - **Sign-off Section**: Pre-formatted lines for line supervisors and production managers.
  - **Generous Column Proportions**: Expanded column widths (12–24 characters) preventing any clipped cells.
- **Export Formats Available**:
  - Professional Excel (`.xlsx`)
  - Lightweight CSV (`.csv`)
  - Master DC Directory Excel Export (from the DC Hub)

---

### 6. Delivery Challan (DC) Hub
- Search by DC #, Line, Assembly, or Article.
- Status filters: `All`, `Process`, `Inline`, and `Complete`.
- Real-time summary statistics cards (Total DCs, Active Production, Inline Lines, Completed Orders).
- Quick modal creation and editing for Delivery Challans with input validation.

---

## 🛠️ Tech Stack & Key Files

| Module / File | Description |
| :--- | :--- |
| `components/DateRegisterLedger.tsx` | Main date-wise planning ledger, balance engine, and month ribbon. |
| `components/PrintRegisterModal.tsx` | Print preview modal and landscape print sheet layout. |
| `lib/exportUtils.ts` | High-fidelity ExcelJS exporter and CSV generator. |
| `components/DCHub.tsx` | Delivery Challan management dashboard and filter system. |
| `components/NewDCModal.tsx` | Modal dialog for creating and updating Delivery Challans. |
| `app/globals.css` | Tailwind configuration and `@media print` styling rules. |
| `types/index.ts` | TypeScript interfaces for Challans, Planning Rows, Totals, and User Profiles. |
| `app/api/planning/route.ts` | Backend API for persisting planning rows and calculation state. |
| `app/api/challans/route.ts` | Backend API for managing Delivery Challans. |

---

## 🚀 How to Run & Verify

1. **Start Development Server**:
   ```bash
   npm run dev
   ```
2. **Build for Production**:
   ```bash
   npm run build
   ```
3. **Lint Codebase**:
   ```bash
   npm run lint
   ```
