# Context & Setup
You are building the frontend for a "Prepaid Meter Recharge Advisor" application. The app helps families in Dhaka visualize their electricity meter balance and predict recharge needs. 
Please implement the frontend using modern React, Tailwind CSS, and the `uipro` components initialized in this project. Do not implement the backend calculation engine yet; focus strictly on the UI shell, data ingestion, and data visualization phases.

## Data Schema
The app will ingest JSON data representing a household's usage and recharge history[cite: 1]. The schema includes:
* `opening_balance_bdt`: String representing initial money.
* `days`: Array of objects with `date` (YYYY-MM-DD) and `units` (integer).
* `recharges`: Array of objects with `date` and `amount_bdt`.
* `today`, `usual_daily_units`, and `target_date` for predictions.
* `comparison`: Object containing parameters for habit comparison.

## Frontend Execution Steps
Please execute the following frontend phases in order:

1. **Scaffolding:** Create the main application layout. Include a responsive navbar, a main content area, and a sidebar or grid system for widgets. 
2. **Data Ingestion UI:** Build a clean text area component where a user can paste the JSON data described above[cite: 1]. Include a "Load Data" button that parses this JSON into the application state.
3. **Balance Charting:** Integrate a charting library (like Recharts). Create a line chart component to plot a mock daily balance over time. Add visual markers (like dots or vertical lines) on dates where a recharge occurred.
4. **Prediction UI:** Create two prominent metric cards. One card will display "Date Balance Runs Out" and the other will display "Amount Needed Today (BDT)". Design these to look like critical alerts.
5. **Comparison View:** Design a side-by-side comparison table or dual-card layout. It needs to contrast the "Low Balance Habit" vs. "Monthly Habit", highlighting the total cost and the difference.

## Design Guidelines
* Use a clean, modern aesthetic with ample whitespace.
* Ensure all cards and charts are fully responsive.
* Stub out the data for the charts and prediction cards using hardcoded placeholder states until the backend calculation engine is wired up later.