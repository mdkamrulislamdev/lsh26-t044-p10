export type BalancePoint = {
  date: string
  balance: number
  recharge: boolean
  rechargeAmount?: number
}

export const PLACEHOLDER_BALANCE: BalancePoint[] = [
  { date: '2026-08-01', balance: 2500, recharge: false },
  { date: '2026-08-02', balance: 2285, recharge: false },
  { date: '2026-08-03', balance: 2060, recharge: false },
  { date: '2026-08-04', balance: 1880, recharge: false },
  { date: '2026-08-05', balance: 1610, recharge: false },
  { date: '2026-08-06', balance: 1400, recharge: false },
  { date: '2026-08-07', balance: 1235, recharge: false },
  { date: '2026-08-08', balance: 1040, recharge: false },
  { date: '2026-08-09', balance: 755, recharge: false },
  { date: '2026-08-10', balance: 1745, recharge: true, rechargeAmount: 1200 },
  { date: '2026-08-11', balance: 1535, recharge: false },
  { date: '2026-08-12', balance: 1310, recharge: false },
  { date: '2026-08-13', balance: 1055, recharge: false },
  { date: '2026-08-14', balance: 860, recharge: false },
  { date: '2026-08-15', balance: 650, recharge: false },
  { date: '2026-08-16', balance: 470, recharge: false },
  { date: '2026-08-17', balance: 230, recharge: false },
  { date: '2026-08-18', balance: 5, recharge: false },
  { date: '2026-08-19', balance: 0, recharge: false },
  { date: '2026-08-20', balance: 0, recharge: false },
  { date: '2026-08-21', balance: 0, recharge: false },
  { date: '2026-08-22', balance: 800, recharge: true, rechargeAmount: 800 },
  { date: '2026-08-23', balance: 575, recharge: false },
  { date: '2026-08-24', balance: 395, recharge: false },
  { date: '2026-08-25', balance: 140, recharge: false },
  { date: '2026-08-26', balance: 0, recharge: false },
  { date: '2026-08-27', balance: 0, recharge: false },
  { date: '2026-08-28', balance: 0, recharge: false },
  { date: '2026-08-29', balance: 0, recharge: false },
  { date: '2026-08-30', balance: 0, recharge: false },
]

export const PLACEHOLDER_PREDICTION = {
  runsOutOn: '2026-09-04',
  runsOutLabel: '4 Sep 2026',
  daysRemaining: 5,
  amountNeededToday: 1850,
  targetDate: '2026-09-15',
}

export const PLACEHOLDER_COMPARISON = {
  lowBalance: {
    label: 'Low Balance Habit',
    totalCost: 3200,
    notes: 'Top up a large amount only after the meter falls below the low-balance threshold.',
  },
  monthly: {
    label: 'Monthly Habit',
    totalCost: 2650,
    notes: 'One planned recharge at the start of each comparison month.',
  },
  difference: 550,
}
