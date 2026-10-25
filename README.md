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

### 7. Automated Expected Output Scheduling Formula & Full-Width Layout
- **Formula-Driven Auto-Fill**:
  - Automatically calculates production days needed: `Days = ceil(Balance / Daily Target)`.
  - When the manager enters a daily quota (e.g., `800`) on any date, downstream working days automatically populate with that rate.
  - **Sundays Off**: Automatically skips all Sundays (marked `OFF` or disabled with `—`), never scheduling quotas on weekly rest days.
  - **Final-Day Remainder**: The final calculated production day receives the exact remaining balance (e.g. `350` or `566`) so the scheduled quota matches the lot total.
  - Automatic continuation across month boundaries if the required days exceed the current calendar month.
  - Integrated notification banner with 1-click **"Undo Auto-Fill"** and an **"Auto-Schedule Quota"** toolbar button with quick rate presets (`500`, `650`, `800`, `1000`, `1200`).
- **Edge-to-Edge Full-Page Fluid Layout**:
  - Removed restrictive container box constraints (`max-w-7xl`) on the ledger view, allowing the table to expand full-width across wide monitors.
  - Enlarged cell dimensions and typography (`text-sm font-bold` for numeric values, larger stepper inputs) for easy shop-floor readability.

### 8. Bug Fixes: Day 1 Input Addition & Initial Days Gap Calculation
- **Fixed Day 1 Input Replacement Bug**:
  - Previously, entering an input on Day 1 (e.g. `500` with lot quantity `9,000`) overwrote the opening quantity with `500`, setting balance to `500` instead of `9,500`.
  - Fixed so Day 1 balance is always `Opening QTY + Day 1 Input` (e.g. `9,000 + 500 = 9,500`), preserving the full delivery challan order quantity.
- **Fixed Initial Days Gap Calculation**:
  - Previously, the Days Gap was never computed for the first actual output entry because the reference date was only initialized after the first output had occurred.
  - Fixed so the reference date begins at the order start date (`challan.orderDate`). If production is delayed by 3–4 days in the first week, the gap (e.g. `3d`) is now immediately and accurately calculated on the first actual output entry.

### 9. Instant Session Resolution (Eliminated Stuck Loading Screen)
- **Zero-Delay Startup**:
  - Replaced the blocking 6-second server verification check with instant local session resolution (`0ms`).
  - If a cached user session exists, the application immediately renders the active dashboard with full CSS styles.
  - If no session exists, the login page is rendered immediately without freezing on "Verifying authorized credentials...".
  - Removed legacy filter that inadvertently wiped sessions for admin accounts on browser refresh.
  - Server-side verification now runs asynchronously in the background.

### 10. Item Classification, First Expected Date Auto-Scheduling & DC Hub Balance Tracking
- **Item Garment Type Field**:
  - Added dedicated **Item** field to the New DC & Edit DC modals with instant quick-selection chips (`Skirt`, `Jacket`, `Jeans`, `Trousers`, `Shorts`, `Shirt`, `Hoodie`) and custom entry.
  - Added dedicated **Item** column in the All DCs Hub table right beside *Article / Style*.
  - Added Item display to the DC Master header in the Date Register Ledger.
  - Search filter in DC Hub now supports querying by Item name.
  - Professional Excel (`.xlsx`) export updated to include the Item column.
- **First Expected Output Date & Daily Rate Auto-Scheduling**:
  - In the New DC Modal, managers can specify the **First Expected Date** (when sewing output starts, even if days after fabric delivery) and **Daily Expected Rate** (e.g. `800` pcs/day).
  - Features real-time formula calculation preview directly in the modal (e.g., `⚡ Will auto-schedule 7 working days starting 26-Oct (6 days × 800 pcs + 1 final day × 350 pcs, Sundays skipped)`).
  - When the DC is opened, the system automatically populates the daily quota starting strictly from that date:
    - `Days needed = ceil(Opening Qty / Daily Rate)`.
    - Automatically skips all Sundays (weekly off-days).
    - Allocates the exact remainder on the final day so total scheduled matches lot quantity.
- **Remaining Balance (Left Qty) & Completion Progress in DC Hub**:
  - Added a dedicated **Remaining Balance** column in the All DCs Hub table:
    - High-visibility pieces remaining (e.g. `4,850 pcs left`).
    - Visual progress bar and percentage completion (e.g. `30% finished`).
    - Green `Complete (0 left)` badge with `100% finished` indicator when production is concluded.
  - Top stat card aggregates the total pending balance across all active challans on the production floor.
- **Edge-to-Edge Responsive Fluid Layout for Laptop Screens**:
  - Removed restrictive `max-w-7xl` container constraints from the application viewport and header.
  - The All DCs Hub and Date-Wise Production Register expand fluidly to fill laptop and desktop screens edge-to-edge.
  - Enlarged typography, numbers, and progress indicators for clear shop-floor visibility without small or cramped numbers.
- **Zero-Downtime Supabase Architecture**:
  - Reads and writes `item`, `first_expected_date`, and `daily_expected_rate` directly with native columns when present.
  - Automatically falls back to metadata tags in `remarks` if custom database column migrations have not yet been run by the database admin.

---

### 11. Smart Search Normalizer, Top 10 Batch Loading & Supabase Quota Resilience
- **Smart Multi-Format Search Normalizer**:
  - Fixed search bar so typing `"dc"`, `"#"` or prefixed formats no longer yields "No delivery challans match":
    - Typing `"dc"` or `"#"` &rarr; Matches all Delivery Challans immediately.
    - Typing `"dc 7596"`, `"dc#7596"`, `"DC-7596"`, or `"#7596"` &rarr; Matches DC #7596 accurately.
    - Typing raw digits (e.g. `"7596"`) &rarr; Matches DC #7596.
    - Continues matching Line/Assembly (`line 3`), Article/Style (`GJNO02314`), Item (`Jacket`, `Skirt`), and remarks.
  - Added a quick-clear (`X`) button inside the search input to reset queries with a single click.
- **Top 10 Latest DC Batch Loading with "Load 10 More"**:
  - By default, the Delivery Challan Hub loads the **10 most recent** Delivery Challans ordered chronologically.
  - Added an action toolbar at the bottom of the table:
    - Current counter: `Showing 10 of 42 latest Delivery Challans`.
    - **`Load 10 More`** button with a live badge showing the exact remaining count (e.g. `32 remaining`).
    - **`View All`** button to expand the complete list.
    - **`Show Top 10 Only`** toggle to collapse back to the compact view.
- **Global Instant Search Across All Archives**:
  - When a user enters any search term or applies a status filter (`Process`, `Inline`, `Complete`), the system automatically searches across **all historical Delivery Challans** across the entire archive (not limited to 10), ensuring older lots are immediately found and opened.
  - Displays a dedicated indicator: `Found X matching Delivery Challans across entire archive` with a **`Reset Search`** button.
- **Supabase Quota Limits & Connection Resilience**:
  - Optimized queries in `app/api/challans/route.ts` and `lib/storage.ts` to prevent quota exhaustion and rate limit errors.
  - Wrapped server endpoints with graceful fallbacks so if cloud quota limits are reached on the Supabase free tier, the system immediately serves cached local data without crashing or displaying blocking error alerts.
- **Full Laptop Screen Edge-to-Edge Responsive Layout**:
  - Layout expands to the full viewport width (`w-full px-2 sm:px-4 lg:px-6`) without cramped artificial containers, ensuring all 9 table columns, status selectors, progress bars, and action buttons fit comfortably on laptop screens.

### 12. Cloud Run Service Deployment & Standalone Build Resolution (Oct 23, 2026)
- **Cloud Run Precondition Check & Publish Fix**:
  - Resolved `Precondition check failed` deployment error by linking `/package.json` and workspace root paths.
  - Standardized Next.js production build (`NODE_ENV=production next build`) so standalone traces and static generation compile with zero errors.
  - Added dedicated App Router `app/not-found.tsx` and `app/error.tsx` handlers, eliminating legacy Pages Router `_document` / `Html` prerender collisions on 404 / error boundaries.
  - Verified `compile_applet` builds with 100% success across all routes and API endpoints.
- **Bulletproof DC Search Normalizer**:
  - Typing `d`, `dc`, `dc `, `dc#`, `dc no`, `challan`, or `delivery` immediately matches all Delivery Challans.
  - Sub-string and numeric matching seamlessly extracts numbers from `#7596`, `dc 7596`, `dc#7596`, `7596`, etc., alongside Assembly/Line, Article, Item, and Notes.

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
