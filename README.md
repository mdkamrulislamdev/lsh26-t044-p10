# Meter Advisor — Prepaid Meter Recharge Advisor (P10)

LofiStack Hackathon 2026 · Problem **P10**

A working advisor for Dhaka households on prepaid electricity. Paste a household JSON case, rebuild the meter balance day by day using official-style tariff slabs, see when the balance runs out, and compare a “low balance” top-up habit with a “1st of the month” habit.

**Live URL:** _add the public deployment URL here (Vercel / Netlify / similar). Judges must open it with no setup._

**Demo video:** _add a ≤ 60 second link showing Load Data → chart → forecast → habit comparison._

---

## What this project does

Families on DESCO-style prepaid meters often top up in a panic when the display is almost empty. That habit can cost more than a planned monthly recharge because **meter rent and demand charge are taken on the first recharge of each calendar month**.

Meter Advisor takes one public case (or a pasted case) and:

1. **Ingests** household JSON (`opening_balance_bdt`, `days`, `recharges`, `today`, `usual_daily_units`, `target_date`, `comparison`).
2. **Rebuilds balance history** with a chronological engine: monthly slab reset on the 1st, stepped energy rates, 5% VAT on energy, and ৳82 fixed charges (meter rent ৳40 + demand ৳42) on the **first recharge of each month**.
3. **Forecasts** the date the current balance hits zero at `usual_daily_units`, and the amount to recharge **today** to last until `target_date` (fixed charges only for the current month if that single top-up covers several months).
4. **Compares habits** over the three `comparison.months`: recharge `low_amount_bdt` when balance falls below `low_threshold_bdt` vs recharge `monthly_amount_bdt` on the 1st. Same consumption; any cost gap comes from how often monthly fixed charges are incurred.

### MVP coverage

| Required product surface | Status |
|---|---|
| Data input (paste JSON + Load Data) | Working |
| Balance history chart with recharge markers | Working (engine, not a stub series) |
| Run-out date + amount needed today (BDT) | Working (engine) |
| Low Balance vs Monthly habit comparison | Working (engine) |

Paste a **single case object** (for example `PUB-01` from `docs/P10_prepaid_meter_public.json`), or paste the **full public file**; the app uses the first case in `cases`.

---

## How to run

**Judges:** use the Live URL above. No install is required.

**Local development**

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build
npm run preview
```

### Try it

1. Open `docs/P10_prepaid_meter_public.json` (or `public/P10_prepaid_meter_public.json`).
2. Copy one case object (`case_id`, `opening_balance_bdt`, `days`, `recharges`, `today`, …) **or** copy the whole file.
3. Paste into **Data Input** and click **Load Data**.
4. Confirm **Loaded ✓**, the step chart, green recharge dots, forecast cards, and habit totals.

Engine logic lives in `src/billingEngine.ts` (slabs, simulation, predictions, habit comparison). The UI is `src/App.tsx`. How a click becomes a taka amount is explained in **[architecture.md](./architecture.md)** (written for non-specialists as well as builders).

**Tariff constants (do not treat as a live DESCO feed):** slabs 4.63 / 5.26 / 5.63 / 5.83 / 9.30 / 10.70 BDT per unit; VAT 5% on energy only; meter rent 40 + demand 42.

### Tests

```bash
npm run test:engine
```

This loads every case in `docs/P10_prepaid_meter_public.json`, runs `runSimulation` / `runPredictions` / `compareHabits`, checks VAT (5% of energy), 1st-of-month slab reset, recharge totals vs JSON, fixed charges of 0 or 82, and that habit cost gaps are multiples of 82. Report: `docs/test_report.json`. UI walkthrough: `MANUAL_CHECKLIST.md`.

---

## What is mocked

These are **not** mocked:

- Day-by-day balance reconstruction (`runSimulation`)
- Slab splitting when a day crosses a tariff boundary (`calculateEnergyCost`)
- Calendar-month slab reset and first-recharge fixed charges
- Run-out date and target recharge (`runPredictions`)
- Habit comparison totals (`compareHabits`)

These **are** mocked, approximated, or out of scope:

| Item | Reality |
|---|---|
| DESCO / NESCO live meter API | Not connected. Input is pasted JSON only. |
| Official published tariff circular | Rates are the problem’s fixed constants, not a live lookup. |
| “Slab penalty” line in the forecast card | Display helper: energy cost minus (units × 4.63). Not a separate billed fee. |
| `comparison.source` / `daily_units` | Habit sim uses the case’s own daily `units` for the comparison months. |
| Auth, accounts, persistence | None. Refreshing the page clears loaded JSON. |
| Backend / database | None. All math runs in the browser. |
| Multi-case picker | A full `{ "cases": [...] }` file loads **case 0** only. |
| Hosting | Until a Live URL is filled in above, judges must run locally. |

Empty input, invalid JSON, and missing `opening_balance_bdt` / `days` / `recharges` show an error and do not crash the page.

---

## What we would build next

With more time we would:

1. **Ship a public Live URL** and a ≤ 60s demo that walks Load Data → chart → forecast → comparison.
2. **Case selector** for all 25 public cases, plus a one-click “Load PUB-01”.
3. Expand engine tests if official tariff circulars add extra edge rules.
4. Honour `comparison.source` when `daily_units` is not `null`.
5. Bengali copy, SMS-style “recharge today” summary, and a printable advice card for the household.
6. Confirm remaining DESCO edge rules (if any) against a published circular: VAT on fixed charges, lost-day gaps, and negative balance display.

---

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS v4, Recharts. No copyleft dependencies (see `LICENSES.md`).

---

## Submission checklist (this problem)

- [x] Source code in this repository
- [ ] Live URL that opens with no setup
- [x] README: what it does, how to run, what is mocked, what is next
- [ ] Demo video ≤ 60 seconds of the working product
- [x] `LICENSES.md` for third-party code and fonts
