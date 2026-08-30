import type { HouseholdData } from '../types'

export const SAMPLE_DATA: HouseholdData = {
  case_id: 'DEMO-01',
  opening_balance_bdt: '350.00',
  days: [
    { date: '2026-01-01', units: 5 },
    { date: '2026-01-02', units: 4 },
    { date: '2026-01-03', units: 6 },
    { date: '2026-01-04', units: 5 },
    { date: '2026-01-05', units: 4 },
    { date: '2026-01-06', units: 3 },
    { date: '2026-01-07', units: 7 },
    { date: '2026-01-08', units: 5 },
    { date: '2026-01-09', units: 4 },
    { date: '2026-01-10', units: 6 },
    { date: '2026-01-11', units: 5 },
    { date: '2026-01-12', units: 4 },
    { date: '2026-01-13', units: 5 },
    { date: '2026-01-14', units: 6 },
  ],
  recharges: [
    { date: '2026-01-03', amount_bdt: '1000.00' },
    { date: '2026-01-12', amount_bdt: '500.00' },
  ],
  today: '2026-01-14',
  usual_daily_units: 9,
  target_date: '2026-01-25',
  comparison: {
    months: ['2026-04', '2026-05', '2026-06'],
    source: 'readings',
    daily_units: null,
    opening_balance_bdt: '0.00',
    low_threshold_bdt: '100.00',
    low_amount_bdt: '2000.00',
    monthly_amount_bdt: '2000.00',
  },
}

export const SAMPLE_JSON = JSON.stringify(SAMPLE_DATA, null, 2)
