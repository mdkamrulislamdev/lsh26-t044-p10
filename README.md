# MeterWise — Prepaid Meter Recharge Advisor (P10)

LofiStack Hackathon 2026 · Problem **P10**

Four tabs, in order: **Household → Balance → Questions → Habits**.

**Live URL:** _add the public deployment URL here._

**Demo video:** _add a ≤ 60 second link: Load 6-month household → Balance → Questions → Habits._

---

## How to run

Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build
npm run preview
npm run test:engine
```

Engine tests need `docs/P10_prepaid_meter_public.json` on disk (gitignored; copy from the problem pack). The app itself does not need that file — it ships `src/data/household.json`.

---

## How to check the four required items

### 1. Household

1. Open the app. You start on **Household**.
2. Click **Load 6-month household**.
3. Confirm at least **6 months**, a **light** month, a **heavy** month, and a **last-week** recharge (built-in family: January light, May heavy, ৳5,000 on 28 June).
4. Optional: paste a public case JSON and click **Load pasted JSON**.

Empty paste and broken JSON show an error and do not crash.

### 2. Balance

1. Click **Next: Balance** (or the Balance tab).
2. You should see a **line** of daily balance.
3. **Green marks** are recharges. Hover a mark: date and amount should match the household `recharges`.
4. A recharge does **not** reset the slab. The slab counter resets on the **1st**. ৳82 (meter rent 40 + demand 42) is taken on the **first recharge of each calendar month**. VAT is **5% of energy only**.

### 3. Questions

1. Open **Questions**.
2. **When does the balance run out?** uses today’s rebuilt balance and `usual_daily_units`.
3. Pick a date. **How much to recharge today** is energy + higher slab + fixed charges + VAT.
4. Change the date: the total should change.

### 4. Habits

1. Open **Habits**.
2. Same three months, same daily units.
3. **Cost is not the deposit.** It is energy + VAT + ৳82 when that month took a first recharge.
4. The banner says which habit costs less **and by how much**, or that they **tie**.

---

## Edge cases judges mark

| Check | What should happen |
|---|---|
| **R-16 same consumption** | Both habits use the same daily units and the same month slab counter. Recharge timing cannot create an energy-rate saving. |
| **R-16 difference** | Any gap is only how many times ৳82 was taken. Difference is 0, 82, 164, … A fabricated slab saving is a failure. A **tie is allowed**. |
| **R-33 cost** | Cost = energy + VAT + applicable monthly fixed charges. **Not** the money deposited. |
| **R-33 low balance** | Recharges the case amount at the **start of any day** whose balance is **below** `low_threshold_bdt`. |
| **R-33 monthly** | Recharges the case amount on the **1st** of each month. Both habits start from `comparison.opening_balance_bdt` and run `comparison.months`. |
| **VAT** | VAT line = 5% of **energy**, never 5% of energy + ৳82. |
| **Fixed charges (questions)** | ৳82 in the breakdown only if this calendar month has **not** already taken rent+demand. One top-up today does **not** add extra ৳82 for later months. |
| **Slab reset** | On the 1st, units start again at 4.63. A mid-month recharge does not cheapen later units. |
| **Empty / invalid JSON** | Red error. Page stays up. |
| **No household yet** | Balance / Questions / Habits tell you to load Household first. |

Automated checks: `npm run test:engine` (25 public cases + unit checks). Screen walkthrough: `MANUAL_CHECKLIST.md`.

Tariff constants (not a live DESCO feed): 4.63 / 5.26 / 5.63 / 5.83 / 9.30 / 10.70 BDT per unit; VAT 5% on energy; meter rent 40 + demand 42.

---

## What is not mocked

Day-by-day rebuild, slab splits, first-recharge ৳82, run-out date, amount needed today, habit totals. All run in the browser from `src/billingEngine.ts`.

## What is out of scope

No live meter API, no login, no database. A `{ "cases": [...] }` paste uses the **first** case. Refreshing the page clears the loaded household.

---

## Tech

React 19, TypeScript, Vite, Tailwind CSS v4, Recharts. Licenses: `LICENSES.md`.
