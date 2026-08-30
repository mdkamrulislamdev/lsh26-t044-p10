# Manual checking checklist (P10)

App tabs: **Household → Balance → Questions → Habits**. Engine: `npm run test:engine` (needs `docs/P10_prepaid_meter_public.json` locally).

## Household

- [ ] **Load 6-month household:** at least 6 months; light month; heavy month; last-week recharge (built-in: Jan light, May heavy, ৳5,000 on 28 Jun).
- [ ] **Empty paste:** Load pasted JSON with an empty box → error; no crash.
- [ ] **Broken JSON:** paste `not json` → error; no crash.

## Balance

- [ ] Line of daily balance after load.
- [ ] Green marks match `recharges` (hover date + amount).
- [ ] ৳82 only on the first recharge of a calendar month; VAT is 5% of energy.

## Questions

- [ ] Run-out date uses today’s rebuilt balance and usual daily units.
- [ ] Pick a later date: amount needed today updates.
- [ ] Breakdown has Energy, Higher slab, Fixed charges, VAT.
- [ ] VAT = 5% of Energy, not of energy + 82.
- [ ] Fixed charges are **82** if this month has no recharge yet, else **0**. Later months on this one top-up add no extra 82.

## Habits (R-16, R-33)

- [ ] Same three months, same daily units. Cost is energy + VAT + 82s, **not** deposits.
- [ ] Low balance: recharge at **start of day** if balance is **below** the threshold.
- [ ] Monthly: recharge on the **1st**. Both start from `comparison.opening_balance_bdt`.
- [ ] Difference is a multiple of 82, including **0 (tie)**. No fabricated slab saving.
