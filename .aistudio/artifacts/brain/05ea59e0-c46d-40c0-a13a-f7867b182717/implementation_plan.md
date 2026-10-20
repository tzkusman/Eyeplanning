# EYE Planning Software (Denim Crafts) - Complete Remake

A completely rebuilt, production-grade manufacturing planning web application for Denim Crafts Karachi. Features a clean date register table with genuine production logic (Opening QTY, Date-wise Input additions, Expected Output, Actual Output, and auto-calculated Balance), server-side Next.js API proxy routes powered by the Supabase Service Role Key to guarantee 100% reliable cloud persistence bypassing RLS, custom EYE SVG branding, and multi-DC management.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been incorporated based on your direct instructions:

- **Server-Side API Routes with Supabase Service Role Key (Bypassing RLS)**:
  - All database operations (create DC, delete DC, update DC, log daily input/output) will run through Next.js server-side API routes (`/api/challans`, `/api/challans/[id]`, `/api/planning`, `/api/setup`) using the `SUPABASE_SERVICE_ROLE_KEY`.
  - Bypasses Supabase Row Level Security (RLS) entirely, guaranteeing that data is directly written to and read from the live PostgreSQL database with zero permission or sync errors.
- **Genuine Production Planning Logic (No Artificial "Targets")**:
  - Removed all artificial "monthly targets" or locking mechanisms.
  - When opening a DC, the user only specifies **DC Number**, **Party / Buyer**, **Article / Style**, **Order Date**, and **QTY** (e.g. 6,300 pcs).
  - Inside the DC register:
    - **Date**: Any month and year can be selected dynamically (defaults to current active calendar month).
    - **DC #**: Challan reference.
    - **QTY**: Initial lot quantity on Day 1.
    - **INPUT**: Initial lot quantity on Day 1; on subsequent dates, if buyer supplies more cutting/fabric, entering a value in `INPUT` adds directly to the lot balance.
    - **DAYS GAP**: Auto-calculated gap between active production days.
    - **EXPECTED OUTPUT**: Scheduled daily stitching quota.
    - **ACTUAL OUTPUT**: Realized daily output logged by floor operators.
    - **BALANCE**: Real-time cumulative balance:
      $$\text{Balance}_i = \text{Balance}_{i-1} + \text{Input}_i - \text{Actual Output}_i$$
    - When balance reaches 0, the batch is marked complete!
- **Custom EYE Vector SVG Branding**:
  - Replaces text placeholders with a bespoke, sleek vector Eye SVG logo in the top navigation and brand badges.
- **Multi-DC Management with Real CRUD**:
  - View all active DCs, open new DCs, edit DC specifications, and permanently delete DCs with instant database reflection.
- **Fixed Admin Authentication**:
  - Pre-seeded Super Admin: **`usman@gmail.com`** with Password **`admin786`**.
  - Usman can create and manage `Manager` and `Operator` accounts and assign rights.
- **Downloadable & Copyable Database Migration Script**:
  - Pre-packaged `supabase_schema.sql` file accessible directly in `/public/supabase_schema.sql` and the in-app SQL setup modal for 1-click execution in Supabase SQL editor.

---

### 1. Overview & Core Concept

- **What It Does**: Digitizes factory floor delivery challans and daily production tracking for Denim Crafts in Karachi. Factory managers register challans with opening quantities, select any production month, record daily expected and actual outputs, account for buyer quantity expansions, and track lot balance depletion down to zero.
- **Target Audience / Persona**: Usman (Admin), production managers, and stitching line floor supervisors at Denim Crafts.
- **Key Value**: Provides an immutable, synchronized manufacturing ledger that eliminates spreadsheet errors, verifies output against DC quantities, and writes reliably to the cloud.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Login & Session Management**:
   - Production-ready login screen pre-populated with admin account `usman@gmail.com` / `admin786`.
   - Top navigation bar featuring the **EYE SVG logo**, active DC dropdown switcher, connection status to Supabase, month/year navigator, and view navigation tabs.
2. **Delivery Challans (DC Hub)**:
   - High-level KPI cards: Total Active DCs, Completed Lots, Garments in Progress, and Closed Balances.
   - **`+ Open New DC`** button opening a modal with fields: DC #, Party / Buyer, Article / Style, QTY, and Order Date.
   - Comprehensive DC table with **Open Register**, **Edit DC**, and **Delete DC** (with confirmation) executing real server-side API calls.
3. **Date-Wise Production Register**:
   - Clean, high-density table matching the true manufacturing ledger:
     - Columns: `Date`, `Day`, `DC #`, `QTY`, `INPUT`, `DAYS GAP`, `EXPECTED OUTPUT`, `ACTUAL OUTPUT`, `BALANCE`, `STATUS`.
     - Direct, responsive numeric input boxes for Input, Expected Output, and Actual Output.
     - Saving occurs seamlessly on input blur or Enter key, dispatching real API updates to Supabase.
     - Zero-balance row highlights in soft peach/rose (`#ffe4de`) when balance hits 0.
   - Summary calculation row at the bottom computing `Total QTY`, `Total Input`, `Total Expected`, `Total Actual`, `Current Balance`, and `Completion %`.
4. **Supabase Database & SQL Console**:
   - Status indicator showing live connection to `https://ekesyoziuhkgozcjqztj.supabase.co`.
   - Direct download link for `supabase_schema.sql` and a 1-click copy button.
5. **Admin User Management**:
   - Usman can add, edit, and toggle active status for Managers and Floor Operators.

#### Visual Identity & Theme
- **Style**: Utilitarian, clean industrial web software. Slate neutral backgrounds (`#f8fafc`), clean border cards (`#e2e8f0`), high-contrast dark navy typography (`#0f172a`), deep sky blue accents (`#0284c7`), and emerald green completion highlights (`#16a34a`).
- **Branding**: Custom clean EYE SVG vector logo with precision concentric irises and denim blue accents.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Next.js API Routes with Service Role Key**
  - *Chosen Approach*: All mutations and queries route through `/api/challans` and `/api/planning` on the server using `SUPABASE_SERVICE_ROLE_KEY`.
  - *Why*: Eliminates client-side RLS permission blocks and CORS issues, ensuring that adding, deleting, and updating data in Supabase works 100% of the time.
- **Decision 2: Elimination of Artificial "Targets" or "Locks"**
  - *Chosen Approach*: Only Opening QTY and date-wise Input.
  - *Why*: Directly aligns with the factory manager's physical ledger where extra buyer pieces are recorded directly as Input on the arrival date.
- **Decision 3: Dynamic Real Calendar Month Default**
  - *Chosen Approach*: Defaults to the active lot's order date or current real calendar month (never hardcoded to November).
  - *Why*: Resolves the bug where the UI was stuck displaying November.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EYE PLANNING SOFTWARE                           │
│ (Custom EYE SVG Logo, Active DC Switcher, Month/Year Picker, User Info)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│     DC Manager Hub    │  │  Clean Date Register  │  │ Admin User Management │
│ • Real Supabase List  │  │ • QTY & Input (Day 1) │  │ • Usman Super Admin   │
│ • "+ Open New DC"     │  │ • Date-wise Input Add │  │ • Create Manager/User │
│ • Edit & Delete DC    │  │ • Expected vs Actual  │  │ • Role-Based Rights   │
│ • Status & Balances   │  │ • Auto Days Gap       │  └───────────────────────┘
└──────────┬────────────┘  │ • Running Balance     │
           │               │ • Zero-Balance alert  │
           │               └──────────┬────────────┘
           └──────────────────────────┼───────────────────────────┐
                                      │                           │
                                      ▼                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Server-Side API Proxy Engine (Next.js /api)              │
│  • /api/challans (GET, POST)                                           │
│  • /api/challans/[id] (PUT, DELETE)                                    │
│  • /api/planning (GET, POST upsert)                                    │
│  • /api/setup (Database connection test & table verification)          │
│  • Authenticated via process.env.SUPABASE_SERVICE_ROLE_KEY (Bypasses RLS)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL Cloud Database                  │
│  • Database: https://ekesyoziuhkgozcjqztj.supabase.co                  │
│  • Tables: public.challans, public.planning_schedules, public.profiles │
│  • Downloadable SQL file: /public/supabase_schema.sql                  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Database Tables (Supabase PostgreSQL DDL)
1. **`challans`**: `id` (uuid, primary key), `dc_no` (text, unique), `party` (text), `article` (text), `opening_qty` (numeric), `order_date` (date), `notes` (text), `status` (`OPEN`, `COMPLETED`), `created_at` (timestamptz), `updated_at` (timestamptz).
2. **`planning_schedules`**: `id` (uuid, primary key), `challan_id` (uuid references challans.id), `year` (int), `month` (int), `day_number` (int), `schedule_date` (date), `day_label` (text), `qty` (numeric), `input_qty` (numeric), `buyer_notes` (text), `days_gap` (int), `expected_output` (numeric), `actual_output` (numeric), `balance` (numeric), `is_zero_balance` (boolean), `updated_at` (timestamptz).
   - Constraint: `UNIQUE (challan_id, year, month, day_number)`.
3. **`profiles`**: `id` (uuid, primary key), `email` (text, unique), `full_name` (text), `role` (`admin`, `manager`, `operator`), `password_hash` (text), `is_active` (boolean).
