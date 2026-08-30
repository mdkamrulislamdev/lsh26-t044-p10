# Architecture — MeterWise (P10)

Team **lsh26-t044** · Problem **p10** · Event start code **LSH26-8490-C900**

This file is the full technical story of the Prepaid Meter Recharge Advisor: what each of the four required items does, how the code does it, the formulas, the challenges we hit, the edge cases we implemented, and how the work stays efficient. The UI has four tabs in order: **Household → Balance → Questions → Habits**. All money math lives in `src/billingEngine.ts`. The screen is `src/App.tsx`. There is no backend.

---

## 1. What we built, in one picture

```
Load household JSON
        │
        ▼
  extractCase()          parse opening_balance, days, recharges,
        │                today, usual_daily_units, target_date, comparison
        ▼
  React state: parsedData
        │
        ├─► runSimulation()     item 2: day-by-day balance + recharge marks
        ├─► runPredictions()    item 3: run-out date + amount needed today
        └─► compareHabits()     item 4: low-balance vs 1st-of-month cost
```

A click never invents a taka amount. Tabs only **read** what the engine already computed. Switching tabs does not re-run the engine (`useMemo` keys off `parsedData`, not the active tab).

---

## 2. Working flow (what a user does)

1. Open the live app (or `npm run dev` → `http://localhost:5173`).
2. **Household:** click **Load 6-month household** (or paste a judge case and **Load pasted JSON**).
3. Confirm on screen: at least 6 months, a light month, a heavy month, a last-week recharge.
4. **Next: Balance** — line of daily balance; green marks are recharges; hover a mark.
5. **Next: Questions** — run-out date; pick a date; see energy / higher slab / fixed charges / VAT.
6. **Next: Habits** — same three months, same units; which costs less and by how much (or a tie).

If someone opens Balance / Questions / Habits before loading, the page says to start on Household.

---

## 3. Shared tariff (do not change)

These are the problem’s constants, not a live DESCO feed.

| Rule | Value |
|---|---|
| Slabs (BDT / unit) | 4.63 (1–75), 5.26 (76–200), 5.63 (201–300), 5.83 (301–400), 9.30 (401–600), 10.70 (601+) |
| Meter rent | 40 |
| Demand charge | 42 |
| First recharge of a calendar month | **82** taken from the meter |
| VAT | **5% of energy only**, never of 82 |
| Slab counter | Resets on the **1st of the month**, not on recharge |
| Money | Two decimal places (`roundTaka`) |
| Dates | `YYYY-MM-DD` strings; never `new Date("2026-06-01")` (UTC would shift the 1st) |

### 3.1 Rounding

```
roundTaka(x) = parseFloat(x.toFixed(2))
```

Every energy total, VAT line, daily bill, habit total, and “amount needed today” goes through this.

### 3.2 Calendar month key

```
calendarMonthKey("2026-06-15") → year + (month number − 1)
```

Used only to detect “the calendar month changed.” Display and filters still use `YYYY-MM` (`date.substring(0, 7)`).

### 3.3 Add calendar days (forecast)

Year, month, day are split from the string, then a **local** `Date(year, month - 1, day + n)` is used, then written back to `YYYY-MM-DD`. This keeps “tomorrow” on the civil calendar in Dhaka-style dates, not UTC midnight.

---

## 4. Formula: energy for one day (`calculateEnergyCost`)

A day can sit across two slabs. We do not multiply all of today’s units by one rate.

Let:

- `U` = today’s units  
- `C` = month running units **before** today (0 on the 1st)

Walk the slabs in order. For each slab with upper limit `L` and rate `R`:

```
if C < L:
    room   = L − C
    take   = min(remaining units, room)
    energy += take × R
    remaining -= take
    C += take
```

Then:

```
energy_day = roundTaka(energy)
vat_day    = roundTaka(energy_day × 0.05)
bill_day   = roundTaka(energy_day + vat_day)
```

**Worked split:** month counter already 70, today uses 10 units.

- 5 units still in slab 1 → `5 × 4.63`
- 5 units into slab 2 → `5 × 5.26`

A recharge mid-month does **not** send later units back to 4.63. Only the 1st does.

---

## 5. Item 1 — Household

### What it does

Create (and load) a household with **at least six months** of daily units and recharge history, including:

- a **light** month  
- a **heavy summer** month  
- a month with a **large recharge in the last week**

### How it does it

Built-in case: `src/data/household.json` (`HH-DHAKA-01`).

| Fact | Value |
|---|---|
| Window | January–June 2026 (6 months) |
| Light month | January (lowest monthly unit total) |
| Heavy month | May (highest monthly unit total — summer) |
| Last-week recharge | ৳5,000 on **2026-06-28** (last 7 days of June) |
| Today | 2026-06-30 |
| Usual daily use | 14 units |
| Default target date | 2026-07-25 |
| Habit window | 2026-04, 2026-05, 2026-06 |

After load, the UI **recomputes** months / light / heavy / last-week recharge from the arrays (so a pasted judge case shows its own facts, not hardcoded copy).

Last week of a month = day of month `>` (days-in-month − 7). June has 30 days → days 24–30. The 28th counts.

Paste path: `JSON.parse` → `extractCase`. A `{ "cases": [...] }` file uses **case 0**. Missing `opening_balance_bdt`, `days`, or `recharges` is an error.

### Challenges and edge cases

| Challenge | What we did |
|---|---|
| Empty paste | Error: paste JSON or load the six-month household. No crash. |
| Broken text (not JSON) | Catch, red error, `parsedData` cleared. |
| Full public file | First case only — documented limitation. |
| Time zones | Facts and dates stay `YYYY-MM-DD`; month names from local `Date(y, m-1, 1)`. |
| “Last week” vs day ≥ 25 | Use true last 7 days of that month. |

---

## 6. Item 2 — Day-by-day balance (`runSimulation`)

### What it does

Rebuild the meter **day by day** with the tariff above. Show a **line**. Mark **every recharge**.

### How it does it (one day)

Start from `opening_balance_bdt`. For each reading day, in this order:

1. **New calendar month?** Slab counter `= 0`. First-recharge flag `= false`.
2. **Recharges today:** add each `amount_bdt` to balance. On the **first** recharge this month, subtract **82** and set the flag. Later recharges the same month do not take 82 again.
3. **Energy + VAT** from §4, using the counter **before** today’s units.
4. Subtract `bill_day` from balance.
5. Add today’s units to the month counter.
6. Push a history point: date, balance, recharge total (or null), units, energy, VAT, 82 taken today, running units.

The chart is a step line of `balance`. Green dots + faint vertical lines where `rechargeAmount` is set. Tooltip: date, balance, recharge amount.

Order of operations matters: recharge (and 82) happen **before** that day’s consumption, matching a top-up at the start of the day.

### Formulas

```
if first recharge this calendar month:
    balance += deposit
    balance -= 82
else if recharge:
    balance += deposit          // deposit is not “cost”; it only funds the meter

balance -= bill_day
```

Cost of using electricity that day is `bill_day` (+ 82 if it was the first recharge). The deposit is **not** a billed cost (see item 4 / R-33).

### Challenges and edge cases

| Challenge | What we did |
|---|---|
| UTC `Date` parse moving the 1st to the previous day | Never parse `"YYYY-MM-DD"` as UTC. Month change uses `calendarMonthKey` on the string. |
| Recharge resetting the slab (wrong) | Slab resets only when the month key changes. |
| Two recharges, same day | Sum deposits; 82 at most once that day / month. |
| Two recharges, same month, different days | 82 only on the first of those days. |
| Month with no recharge | 82 not taken. |
| VAT on 82 (wrong) | `vat = roundTaka(energy × 0.05)` only. |
| Hover vs JSON | Chart recharge total must match the sum of JSON recharges on that date (tested). |
| 82 twice in one month | Test fails the case if history takes 82 more than once per `YYYY-MM`. |

---

## 7. Item 3 — Two questions (`runPredictions`)

### What it does

1. Given **today’s rebuilt balance** and **usual daily use**, on which date does the balance run out?
2. To last until a **date the user picks**, how much must be recharged **today**? Break into **energy**, **higher slab**, **fixed charges**, **VAT**.

### How it does it

Start from the history row for `today` (not a guessed balance):

- `balance`, `monthRunningUnits` after that day’s bill  
- `hasPaidFixedChargesThisMonth` = whether **this calendar month** already took 82 in history  

Walk **tomorrow, next day, …** (cap 365 days):

```
each day:
    if new month: slab counter = 0
        (do not add more 82 — this path is one top-up today)
    energy, vat, bill as in §4 using usual_daily_units
    if date ≤ picked target:
        add energy, vat, and (energy − usual_daily_units × 4.63) to the breakdown
    balance -= bill
    if balance ≤ 0 and run-out not set: run-out = this date
```

**Fixed charges for “recharge today”:**

```
if this month has not already taken 82:
    fixed = 82
else:
    fixed = 0
```

Later months in this forecast do **not** add another 82. There is no extra recharge in that story.

**Amount needed today:**

```
energy     = roundTaka(sum of daily energy through target date)
vat        = roundTaka(energy × 0.05)
fixed      = 0 or 82
amount     = roundTaka(energy + vat + fixed)
higher slab = roundTaka(sum (energy_day − usual_daily_units × 4.63))
```

“Higher slab” is a **display helper**: how much of energy is above the first-slab rate. It is not a separate DESCO fee. Energy already includes it.

The date picker defaults to the case `target_date` and can be changed. Min date is `today`.

### Challenges and edge cases

| Challenge | What we did |
|---|---|
| Using JSON `target_date` only | Date `<input type="date">`; engine uses the picked value. |
| Adding 82 on the 1st of **next** month when `today` is month-end and June already paid 82 | Wrong: that charged July’s 82 with no July recharge. **Fix:** 82 at most once, and only if **today’s month** has not paid yet. |
| VAT on energy + 82 | Final VAT is 5% of summed **energy**. |
| Run-out vs target | Run-out walks until empty (or 365 days). Amount only sums days `≤ target`. |
| No run-out in a year | UI: “Does not run out within a year.” |
| No date picked | UI: “Pick a date.” |
| `today` missing | Fall back to last history row. |
| Slab on the 1st in the forecast | Counter resets; daily energy often **drops** even at the same units/day. |

---

## 8. Item 4 — Two habits (`compareHabits`)

### What it does

Same **three months**, same **consumption**: recharge a large amount when the balance is low vs recharge at the **start of each month**. Show which **costs less and by how much**.

Published clarifications (judges mark by these):

- **R-16:** Both habits use identical daily units and the same calendar-month slab counter. Recharge timing **cannot** create an energy-rate saving. A fabricated slab saving is a failure. A **tie is allowed**. Any difference can come only from how many monthly first-recharge 82s occur.
- **R-33:** **Cost** = energy + VAT + applicable monthly fixed charges. **Not** the amount deposited. Low balance: recharge the case amount at the **start of any day** whose balance is **below** the threshold. Monthly: recharge the case amount on the **1st**. Both start from `comparison.opening_balance_bdt` and run `comparison.months`.

### How it does it

Filter `days` to `comparison.months`. If `daily_units` is a number, use that every day; public cases use `source: readings` and `daily_units: null` (the real readings).

Run **two** simulations with the **same** unit series:

**Low balance** (`isMonthlyHabit = false`):

```
at start of day, before units are billed:
    if balance < low_threshold_bdt:
        balance += low_amount_bdt
        if not yet paid 82 this month: balance -= 82; cost += 82
```

**Monthly** (`isMonthlyHabit = true`):

```
if date is the 1st:
    balance += monthly_amount_bdt
    if not yet paid 82 this month: balance -= 82; cost += 82
```

Then both:

```
energy/VAT as in §4 (same U and C → same energy)
cost += bill_day          // not the deposit
```

```
habit cost     = energyAndVat + (82 × months that took a first recharge)
difference     = |low cost − monthly cost|
               = |low 82s − monthly 82s|
winner         = cheaper habit, or Tie if equal
```

Deposits (`2500`, `5000`, …) change **whether the meter stays funded**. They do **not** enter `cost`.

### Challenges and edge cases

| Challenge | What we did |
|---|---|
| Counting deposits as cost | Cost accumulators never add `low_amount_bdt` / `monthly_amount_bdt`. Tests: cost ≪ 2000 deposit on a tiny fixture. |
| Inventing a slab saving because one habit recharges more often | Impossible here: same units, same counter. Tests: difference is a multiple of 82; energy+VAT matches an independent rebuild. |
| Tie | Winner `Tie`, difference `0`. Banner: “Same cost.” |
| `<` vs `≤` threshold | R-33: **below** → `balance < threshold`. |
| Check after consumption (wrong) | Check **start of day**, then bill units. |
| Opening balance | `comparison.opening_balance_bdt` (often `0.00`), **not** the chart’s opening balance. |
| High opening balance | Low-balance may skip a month of 82; monthly still pays on the 1st. Low-balance can win by 82. |
| Extra low-balance top-ups in one month | Extra deposits, still one 82. Energy unchanged. |
| `daily_units` not null | Optional constant units for every comparison day; public pack is readings. |

Built-in habit params: months Apr–Jun 2026, threshold 200, both amounts 2500, opening 0.

---

## 9. Code flow (files)

| File | Role |
|---|---|
| `src/data/household.json` | Item 1 built-in six-month family |
| `src/billingEngine.ts` | Slabs, `runSimulation`, `runPredictions`, `compareHabits` |
| `src/App.tsx` | Four tabs, load/paste, chart, date picker, habit banner |
| `test-runner.js` | 25 public cases + unit checks → `docs/test_report.json` (gitignored) |
| `EVENT.md` | Team ID, problem ID, start code, repo, SHA, live URL |
| `LICENSES.md` | React, Recharts, Vite, Tailwind, fonts |
| `MANUAL_CHECKLIST.md` | Human screen checks |

Unused old UI shells were removed so GitHub only has this product.

**UI data path:**

```
Load button
  → extractCase
  → setParsedData
  → useMemo(runSimulation)
  → useMemo(runPredictions)   // today row + paid-this-month + targetDate
  → useMemo(compareHabits)
  → tabs render
```

Predictions rebuild when the user changes the date picker (`targetDate`).

---

## 10. Efficiency (how we kept it fast and correct)

| Choice | Why |
|---|---|
| One engine file | Chart, questions, and habits cannot drift to different rates. |
| `useMemo` on `parsedData` | Tab clicks do not re-walk six months of days. |
| Filter habit days to three months | Do not simulate January–March for item 4. |
| String dates | No timezone bugs; cheaper than `Date` per day. |
| Round once per day | Matches paisa; avoids long float tails. |
| Forecast cap 365 days | Run-out cannot loop forever. |
| Stop forecast when run-out is known **and** past target | No extra walk. |
| 82 at most once per month | Simple flag, not a search. |
| Tests on all 25 public cases | Catch VAT, slab reset, 82-once, habit multiples of 82, energy rebuild. |

What we would do with more time (not required): Web Worker for huge pastes; virtualise the chart; case picker for all 25 files in the UI.

---

## 11. Challenges we hit (and the fix)

1. **Pretty UI, wrong money.** Early shell used placeholder totals. Fix: engine first, UI only displays engine output.
2. **UTC date bug.** `"2026-06-01"` as `Date` can become 31 May. Fix: split `YYYY-MM-DD`.
3. **Forecast 82 on the next month.** If today is 30 June and June already paid 82, an early draft still added 82 because “tomorrow is a new month.” Fix: one top-up today pays 82 only if **this** month has not paid; no 82 for future months without recharges.
4. **Deposits as cost.** A large low-balance top-up looked “more expensive.” Fix: R-33 — cost is energy + VAT + 82s.
5. **Forcing a winner.** Ties are legal (R-16). Fix: `Tie` when costs are equal.
6. **VAT on 82.** Fix: 5% of energy only.
7. **Slab reset on recharge.** Fix: reset on month change only.
8. **Repo noise.** Unused components, hero image, 23k-line public JSON in `public/`. Fix: delete from git; tests keep a local gitignored copy under `docs/`.

---

## 12. Proof the four items and clarifications are met

| Required item | Proof in product |
|---|---|
| 1. Six-month household | Load button; facts: 6 months, Jan light, May heavy, ৳5000 on 28 Jun |
| 2. Day-by-day line + marks | Recharts step line; green recharge dots; 82 / VAT / slabs in engine |
| 3. Two questions | Run-out card; date picker; four-line breakdown |
| 4. Two habits | Banner + two billed costs; same months/units |
| R-16 same units / no slab trick | `compareHabits` one unit series; difference = 82 × count gap |
| R-16 ties | Winner can be `Tie` |
| R-33 cost ≠ deposit | Deposits never added to `cost` |
| R-33 low vs monthly rules | `< threshold` at start of day; 1st of month; `comparison.opening_balance_bdt` |

Automated: `npm run test:engine` (unit checks + PUB-01 … PUB-25).

---

## 13. Limitations (honest)

- No live DESCO/NESCO meter API.
- Rates are the problem’s table, not a gazetted circular lookup.
- Paste of `{ "cases": [...] }` uses the first case only.
- Refresh clears the loaded household (no login, no database).
- Higher-slab line is energy minus first-slab rate, not a separate bill item.
- Live URL and demo video must be filled for the arena form (see `EVENT.md` / README).

---

## 14. Disclosure

- **Pre-event material:** Vite + React + TypeScript + Tailwind scaffolding only. No prebuilt P10 solution. Declared in `EVENT.md`.
- **Third party:** listed in `LICENSES.md` (React, Recharts, Vite, Tailwind, DM Sans, Source Serif 4).
- **AI assistant:** Cursor used while building; all tariff rules, formulas, and edge-case behaviour above are implemented in this repository and are the team’s responsibility.
- **Secrets:** none. No API keys, tokens, or personal data.

---

## 15. Major decisions

1. **Browser-only engine** so judges can run the live URL with no server.
2. **Four tabs, not a dashboard of everything at once** so each required item is a clear step.
3. **Cost ≠ deposit** even when the UI shows large top-up amounts.
4. **String dates and two-decimal taka** so the 1st and paisa stay stable.
5. **Tests against the public pack** so clarifications R-16 and R-33 stay true on 25 cases, not only the built-in household.
