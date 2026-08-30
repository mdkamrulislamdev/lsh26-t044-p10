# Manual checking checklist (P10)

App tabs: **Household → Balance → Questions → Habits → Plan (bonus)**. Engine: `npm test` (needs `docs/P10_prepaid_meter_public.json` locally). The terminal must list every unit check and every public case as PASS or FAIL, then an overall summary.

## Household

- [x] **Load 6-month household:** at least 6 months; light month; heavy month; last-week recharge (built-in: Jan light, May heavy, ৳5,000 on 28 Jun).
- [x] **Empty paste:** Load pasted JSON with an empty box → error; no crash.
- [x] **Broken JSON:** paste `not json` → error; no crash.

## Balance

- [x] Line of daily balance after load.
- [x] Green marks match `recharges` (hover date + amount).
- [x] ৳82 only on the first recharge of a calendar month; VAT is 5% of energy.

## Questions

- [x] Run-out date uses today’s rebuilt balance and usual daily units.
- [x] Pick a later date: amount needed today updates.
- [ ] Breakdown has Energy, Higher slab, Fixed charges, VAT.
- [ ] VAT = 5% of Energy, not of energy + 82.
- [ ] Fixed charges are **82** if this month has no recharge yet, else **0**. Later months on this one top-up add no extra 82.

## Habits (R-16, R-33)

- [ ] Same three months, same daily units. Cost is energy + VAT + 82s, **not** deposits.
- [ ] Low balance: recharge at **start of day** if balance is **below** the threshold.
- [ ] Monthly: recharge on the **1st**. Both start from `comparison.opening_balance_bdt`.
- [ ] Difference is a multiple of 82, including **0 (tie)**. No fabricated slab saving.

## Plan (bonus)

- [ ] Slab card: units used this month, units left before the next rate, days at usual use.
- [ ] If run-out is Friday or Saturday: recharge-by Thursday and amount through Sunday.
- [ ] **Download family plan PDF** saves `meterwise-family-plan.pdf` locally (nothing uploaded).
