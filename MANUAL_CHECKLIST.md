# Manual checking checklist (P10)

Use a few distinct cases from `docs/P10_prepaid_meter_public.json`. Paste one case (or the full file) into Data Input and click **Load Data**. Automated engine checks: `npm run test:engine`.

## Data & charting

- [ ] **Invalid input:** Paste broken text (not JSON). A red error appears; the app does not crash.
- [ ] **Empty input:** Click Load Data with an empty box. Error: input is empty.
- [ ] **Recharge markers:** Hover green dots. Tooltip date and recharge amount match that case’s `recharges` array.

## Prediction rules

- [ ] **Slab reset:** Pick a case whose run-out date is in a **later calendar month** than `today`. Daily cost should fall on the 1st when the slab counter returns to 4.63 BDT/unit.
- [ ] **Fixed charges:** Target Recharge breakdown shows **82.00 BDT** only if there is **no** recharge yet in the current calendar month of `today`. If there already was one, fixed charges should be **0**. (If `today` is the last day of the month, the engine may charge 82 on the 1st of the *next* month — that is first-recharge-of-month on the first simulated day.)
- [ ] **VAT:** VAT line is **exactly 5% of Energy**, not 5% of energy + fixed charges.

## Habit comparison

- [ ] **Same energy:** Both habits use the same `days` / units. Cost difference is only from how many times **82 BDT** (meter rent + demand) is taken. Difference should be a multiple of 82 (including 0 = tie).
- [ ] **Threshold:** Low Balance habit recharges on the day balance would sit **below** that case’s `low_threshold_bdt`, by `low_amount_bdt`.
