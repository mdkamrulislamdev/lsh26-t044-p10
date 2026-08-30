# Prepaid Meter Recharge Advisor

Frontend UI for families in Dhaka to paste household meter JSON, review a daily balance chart, and compare recharge habits.

## Run

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## What this UI covers

1. Layout with a responsive navbar, sidebar, and widget grid
2. JSON paste area with **Load Data**
3. Recharts line chart with recharge markers (placeholder series)
4. Alert cards for run-out date and amount needed today (placeholder values)
5. Low Balance Habit vs Monthly Habit comparison

The calculation engine is not implemented yet. Chart and forecast widgets stay on stub data.
