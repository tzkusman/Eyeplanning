# Targeted Expected Output Auto-Fill & Full-Width Ledger (Surgical Update)

A focused, non-disruptive update strictly limited to the Date-Wise Production Register and its container layout. No other files, databases, APIs, or features will be modified.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Surgical Scope Guarantee**: As requested ("dont update whole project just add new or update need to be only"), this update touches **only** the specific lines needed in `components/DateRegisterLedger.tsx` and the outer wrapper in `app/page.tsx`. All existing database sync, calculations, modals, and exports remain 100% intact.

- **Automated Expected Output Formula**:
  - When the manager types an Expected Output value (e.g. `800`) on any date row:
    - Calculates required working days: $\lceil \text{Balance} / \text{Daily Rate} \rceil$.
    - Automatically populates the following working days with that value.
    - Strictly skips Sundays (off-days kept as `—` or empty).
    - Sets the exact remaining balance on the final production day.
- **Full-Width Page Expansion**:
  - Replaces `max-w-7xl` in `app/page.tsx` and `components/DateRegisterLedger.tsx` with full fluid width (`w-full px-3 sm:px-6`).
  - Enlarges the font size in the table cells and input fields (e.g., `text-sm font-bold`) so numbers are large, clear, and easy to read without straining.

---

### 1. Minimal Targeted Changes

#### File 1: `components/DateRegisterLedger.tsx` (Only specific functions & classes)
1. **Container & Sizing**:
   - Change table outer container from fixed `max-w-7xl` to `w-full`.
   - Increase text and input font size from `text-xs` to `text-sm font-semibold` and `font-bold` for numbers.
2. **Auto-Fill Handler (`handleExpectedOutputChange`)**:
   - In the existing `onChange` handler for Expected Output:
     - If the user enters a positive number and subsequent days have empty/zero expected output:
     - Compute $\text{remainingBalance} = \text{row.balance}$.
     - Compute $\text{targetRate} = \text{enteredValue}$.
     - Loop through subsequent dates:
       - If Sunday (`date.getDay() === 0`), skip it.
       - If balance $> \text{targetRate}$, assign $\text{targetRate}$ and deduct from balance.
       - On the final day, assign the remaining balance and stop.
     - Update state with the auto-filled rows.

#### File 2: `app/page.tsx` (Only container class)
- Adjust the `<main className="max-w-7xl mx-auto ...">` container to `w-full px-2 sm:px-4 lg:px-6` when viewing the Date Register Ledger, allowing it to stretch edge-to-edge across the screen.

---

### 2. Verification
- Verify that entering `800` into a row immediately auto-fills following working days while leaving Sundays empty.
- Verify that the last day gets the exact remaining balance (e.g., 566 or remainder).
- Verify the table spans the full width of the browser window and numbers are visibly larger.
- Run `compile_applet` and `lint_applet` to ensure zero compilation or build errors.
