export type DailyUsage = {
  date: string
  units: number
}

export type Recharge = {
  date: string
  amount_bdt: number | string
}

export type Comparison = {
  months: string[]
  source: string
  daily_units: number | null
  opening_balance_bdt: string
  low_threshold_bdt: string
  low_amount_bdt: string
  monthly_amount_bdt: string
}

export type HouseholdData = {
  case_id?: string
  opening_balance_bdt: string
  days: DailyUsage[]
  recharges: Recharge[]
  today: string
  usual_daily_units: number
  target_date: string
  comparison: Comparison
}

export type ParseResult = {
  cases?: HouseholdData[]
  error?: string
}

export type NavSection = 'ingest' | 'balance' | 'forecast' | 'habits'
